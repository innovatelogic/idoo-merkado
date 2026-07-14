
//----------------------------------------------------------------------------------------------
// Helpers
//----------------------------------------------------------------------------------------------
function toAmzDate(date) {
  return Utilities.formatDate(date, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

//----------------------------------------------------------------------------------------------
function stringToBytes(str) {
  return Utilities.newBlob(str).getBytes();
}

//----------------------------------------------------------------------------------------------
function sha256Hex(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

//----------------------------------------------------------------------------------------------
function hmacSha256Bytes(dataBytes, keyBytes) {
  return Utilities.computeHmacSha256Signature(dataBytes, keyBytes);
}

//----------------------------------------------------------------------------------------------
function getSignatureKey(secretKey, dateStamp, regionName, serviceName) {

  //Logger.log("=== [DEBUG] getSignatureKey INVOCATION ===");
  //Logger.log("secretKey Length : " + (secretKey ? secretKey.length : "UNDEFINED/NULL"));
  //Logger.log("secretKey Snippet: " + (secretKey ? secretKey.substring(0, 4) + "..." : "N/A"));
  //Logger.log("dateStamp        : " + dateStamp + " (Type: " + typeof dateStamp + ")");
  //Logger.log("regionName       : " + regionName + " (Type: " + typeof regionName + ")");
  //Logger.log("serviceName      : " + serviceName + " (Type: " + typeof serviceName + ")");

  const kDate    = hmacSha256Bytes(stringToBytes(dateStamp), stringToBytes("AWS4" + secretKey));
  const kRegion  = hmacSha256Bytes(stringToBytes(regionName), kDate);
  const kService = hmacSha256Bytes(stringToBytes(serviceName), kRegion);
  const kSigning = hmacSha256Bytes(stringToBytes("aws4_request"), kService);
  return kSigning;
}

//----------------------------------------------------------------------------------------------
function upload_to_s3(data, filename, secrets_fn) {

  const fetch_secrets = secrets_fn || (typeof get_secrets === 'function' ? get_secrets : null);

  if (!fetch_secrets){
    throw Error("[upload_to_s3] Fetch secrets function is null");
  }

  const {
    AWS_ACCESS_KEY,
    AWS_SECRET_KEY,
    AWS_REGION,
    AWS_SERVICE,
    AWS_BUCKET
  } = fetch_secrets();

  let payloadBytes;
  let contentType;

  // -----------------------------
  // Detect type
  // -----------------------------
  if (typeof data === "string") {
    payloadBytes = Utilities.newBlob(data, "text/plain").getBytes();
    contentType = "text/plain; charset=utf-8";

  } else if (data.getBytes) {   // Blob
    payloadBytes = data.getBytes();
    contentType = data.getContentType() || "application/octet-stream";

  } else {
    throw new Error("Unsupported payload type");
  }

  const host = `${AWS_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
  const endpoint = `https://${host}/${filename}`;
  const method = 'PUT';

  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.substr(0, 8);

  // ---------- HASH ----------
  const payloadHash = sha256Hex(payloadBytes);

  // ---------- CANONICAL REQUEST ----------
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    method + '\n' +
    `/${filename}` + '\n' +
    '' + '\n' +
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    payloadHash;

  // ---------- SIGNATURE ----------
  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const stringToSign =
    'AWS4-HMAC-SHA256\n' +
    amzDate + '\n' +
    credentialScope + '\n' +
    sha256Hex(stringToBytes(canonicalRequest));

  const signingKey = getSignatureKey(AWS_SECRET_KEY, dateStamp, AWS_REGION, AWS_SERVICE);
  const signature = hmacSha256Bytes(stringToBytes(stringToSign), signingKey)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // ---------- REQUEST ----------
  const options = {
    method: 'put',
    contentType: contentType,
    payload: payloadBytes,   // ALWAYS BYTES
    headers: {
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authorizationHeader
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  Logger.log(response.getResponseCode());
  Logger.log(response.getContentText());
}

//----------------------------------------------------------------------------------------------
function _del_s3(filename, secrets_fn) {

  const fetchSecrets =
    secrets_fn ||
    (typeof get_secrets === "function" ? get_secrets : null);

  if (!fetchSecrets) {
    throw new Error("Missing secrets function.");
  }

  const {
    AWS_ACCESS_KEY,
    AWS_SECRET_KEY,
    AWS_REGION,
    AWS_SERVICE,
    AWS_BUCKET
  } = fetchSecrets();

  const host = `${AWS_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
  const endpoint = `https://${host}/${filename}`;
  const method = "DELETE";

  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.substring(0, 8);

  // SHA256("")
  const payloadHash =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;

  const signedHeaders =
      "host;x-amz-content-sha256;x-amz-date";

  const canonicalUri =
      "/" + filename.split("/").map(encodeURIComponent).join("/");

  const canonicalRequest =
      method + "\n" +
      canonicalUri + "\n" +
      "" + "\n" +
      canonicalHeaders + "\n" +
      signedHeaders + "\n" +
      payloadHash;

  const credentialScope =
      `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;

  const stringToSign =
      "AWS4-HMAC-SHA256\n" +
      amzDate + "\n" +
      credentialScope + "\n" +
      sha256Hex(stringToBytes(canonicalRequest));

  const signingKey =
      getSignatureKey(
          AWS_SECRET_KEY,
          dateStamp,
          AWS_REGION,
          AWS_SERVICE
      );

  const signature =
      hmacSha256Bytes(
          stringToBytes(stringToSign),
          signingKey
      )
      .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2))
      .join("");

  const authorizationHeader =
      `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`;

  const response = UrlFetchApp.fetch(endpoint, {
    method: "delete",
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Authorization": authorizationHeader
    },
    muteHttpExceptions: true
  });

  Logger.log("HTTP " + response.getResponseCode());

  if (response.getContentText()) {
    Logger.log(response.getContentText());
  }

  return response.getResponseCode();
}

//----------------------------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
    module.exports = { upload_to_s3,
                       _del_s3
                      };
}