
//----------------------------------------------------------------------------------------------
// Helpers
//----------------------------------------------------------------------------------------------
function toAmzDate(date) {
  return Utilities.formatDate(date, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

function stringToBytes(str) {
  return Utilities.newBlob(str).getBytes();
}

function sha256Hex(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function hmacSha256Bytes(dataBytes, keyBytes) {
  return Utilities.computeHmacSha256Signature(dataBytes, keyBytes);
}

function getSignatureKey(secretKey, dateStamp, regionName, serviceName) {
  const kDate    = hmacSha256Bytes(stringToBytes(dateStamp), stringToBytes("AWS4" + secretKey));
  const kRegion  = hmacSha256Bytes(stringToBytes(regionName), kDate);
  const kService = hmacSha256Bytes(stringToBytes(serviceName), kRegion);
  const kSigning = hmacSha256Bytes(stringToBytes("aws4_request"), kService);
  return kSigning;
}

function getSecrets() {
  const props = PropertiesService.getScriptProperties();
  
  return {
    AWS_ACCESS_KEY: props.getProperty('AWS_ACCESS_KEY'),
    AWS_SECRET_KEY: props.getProperty('AWS_SECRET_KEY'),
    AWS_REGION: props.getProperty('AWS_REGION'),
    AWS_SERVICE: props.getProperty('AWS_SERVICE'),
    AWS_BUCKET : props.getProperty('AWS_BUCKET'),
  };
}

//----------------------------------------------------------------------------------------------
// Export
//----------------------------------------------------------------------------------------------
function uploadToS3(data, filename) {

  const {
    AWS_ACCESS_KEY,
    AWS_SECRET_KEY,
    AWS_REGION,
    AWS_SERVICE,
    AWS_BUCKET
  } = getSecrets();

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
