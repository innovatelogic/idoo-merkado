/**
 * Downloads a file from an arbitrary URL stream and uploads it to an AWS S3 Bucket.
 * Safely accepts a secrets callback function to load environment variables locally.
 * 
 * @param {string} url - The source file URL stream (e.g. your products_feed.xml link).
 * @param {string} filename - The target destination filename path in S3 (e.g. "feeds/products.xml").
 * @param {function} secrets_fn - Callback function that returns the AWS credentials object.
 */
function download_to_s3_stream(url, filename, secrets_fn) {
  // 1. Guard check and resolve the secrets function callback safely
  const fetchSecrets = secrets_fn || (typeof get_secrets === 'function' ? get_secrets : null);
  if (!fetchSecrets || typeof fetchSecrets !== 'function') {
    throw new Error("[download_to_s3] Missing or invalid secrets callback function.");
  }

  // Execute callback and extract the configurations natively into local scope
  const {
    AWS_ACCESS_KEY,
    AWS_SECRET_KEY,
    AWS_REGION,
    AWS_SERVICE,
    AWS_BUCKET
  } = fetchSecrets();

  // Validate presence before spinning up the crypto layer
  if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY || !AWS_REGION || !AWS_SERVICE || !AWS_BUCKET) {
    throw new Error("[download_to_s3] Critical AWS configurations are missing from secrets provider.");
  }

  try {
    // 2. Stream download the arbitrary URL into Google memory limits
    Logger.log(`[Pipeline] Downloading source asset from: ${url.substring(0, 60)}...`);
    const downloadResponse = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (downloadResponse.getResponseCode() !== 200) {
      throw new Error(`Failed to download source file. Status code: ${downloadResponse.getResponseCode()}`);
    }

    const blob = downloadResponse.getBlob();
    const payloadBytes = blob.getBytes();
    const contentType = blob.getContentType() || "application/octet-stream";

    // 3. Setup S3 structural routes
    const host = `${AWS_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
    const endpoint = `https://${host}/${filename}`;
    const method = 'PUT';

    const now = new Date();
    // Uses modern TextEncoder fallback array logic natively underneath
    const amzDate = Utilities.formatDate(now, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
    const dateStamp = amzDate.substring(0, 8);

    // 4. Calculate SHA-256 binary hash signatures
    const payloadHash = _internalSha256Hex(payloadBytes);

    // 5. Structure AWS Canonical Request
    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;

    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    // Ensure the URI paths are correctly encoded for custom directory strings
    const canonicalUri = "/" + filename.split('/').map(encodeURIComponent).join('/');

    const canonicalRequest =
      method + '\n' +
      canonicalUri + '\n' +
      '' + '\n' +
      canonicalHeaders + '\n' +
      signedHeaders + '\n' +
      payloadHash;

    // 6. Generate AWS String to Sign Structure
    const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
    const stringToSign =
      'AWS4-HMAC-SHA256\n' +
      amzDate + '\n' +
      credentialScope + '\n' +
      _internalSha256Hex(_internalStringToBytes(canonicalRequest));

    // 7. Derive the regional multi-leg signing key
    const kDate    = Utilities.computeHmacSha256Signature(_internalStringToBytes(dateStamp), _internalStringToBytes("AWS4" + AWS_SECRET_KEY));
    const kRegion  = Utilities.computeHmacSha256Signature(_internalStringToBytes(AWS_REGION), kDate);
    const kService = Utilities.computeHmacSha256Signature(_internalStringToBytes(AWS_SERVICE), kRegion);
    const kSigning = Utilities.computeHmacSha256Signature(_internalStringToBytes("aws4_request"), kService);

    // Compute the absolute cryptographic signature
    const signature = Utilities.computeHmacSha256Signature(_internalStringToBytes(stringToSign), kSigning)
      .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

    const authorizationHeader =
      `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // 8. Stream Payload directly to AWS S3 bucket endpoints
    Logger.log(`[Pipeline] Uploading stream to AWS S3 Object key: ${filename}`);
    const s3Options = {
      method: 'put',
      contentType: contentType,
      payload: payloadBytes,
      headers: {
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authorizationHeader
      },
      muteHttpExceptions: true
    };

    const s3Response = UrlFetchApp.fetch(endpoint, s3Options);
    const s3StatusCode = s3Response.getResponseCode();
    
    if (s3StatusCode === 200) {
      Logger.log(`[SUCCESS] File downloaded and piped safely to S3 path: ${filename}`);
      return true;
    } else {
      throw new Error(`S3 rejected storage stream. Code ${s3StatusCode}: ${s3Response.getContentText()}`);
    }

  } catch (err) {
    Logger.log(`[CRITICAL SYSTEM REJECTION] Pipeline crashed: ${err.message}`);
    throw err;
  }
}

// =============================================================================================
// Low-Level Native V8 Crypto Support Blocks (Protects against legacy Utilities.newBlob crashes)
// =============================================================================================
function _internalStringToBytes(str) {
  if (str === undefined || str === null) {
    return [];
  }

  str = String(str);

  const bytes = [];

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);

    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(
        0xC0 | (c >> 6),
        0x80 | (c & 0x3F)
      );
    } else {
      bytes.push(
        0xE0 | (c >> 12),
        0x80 | ((c >> 6) & 0x3F),
        0x80 | (c & 0x3F)
      );
    }
  }

  return bytes;
}

//----------------------------------------------------------------------------------------------
function _internalSha256Hex(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

//----------------------------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
    module.exports = { download_to_s3_stream };
}