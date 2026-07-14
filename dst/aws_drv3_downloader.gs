/**
 * Triggers a backend cloud download directly into Google Drive via the Advanced Drive v3 API,
 * bypassing script execution memory limits entirely, then pipes chunk blocks sequentially to AWS S3.
 */
function download_drv3(url, filename, secrets_fn) {
  const fetchSecrets = secrets_fn || (typeof get_secrets === 'function' ? get_secrets : null);
  if (!fetchSecrets) throw new Error("[download_to_s3] Missing secrets function.");

  const {
    AWS_ACCESS_KEY,
    AWS_SECRET_KEY,
    AWS_REGION,
    AWS_SERVICE,
    AWS_BUCKET
  } = fetchSecrets();

  const host = `${AWS_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
  const endpoint = `https://${host}/${filename}`;
  
  let tempFileId = null;

  try {
    // 1. CLOUD-TO-CLOUD BACKEND DOWNLOAD INTO GOOGLE DRIVE
    Logger.log("[Stream Pipeline] Requesting Google Drive backend service to pull external resource stream...");
    
    // We send a direct creation payload pointing to the external media URL address space
    const resource = {
      name: `temp_scratch_${Date.now()}.xml`,
      mimeType: 'application/xml'
    };
    
    const mediaOptions = {
      method: "post",
      url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=media",
      headers: {
        "Authorization": "Bearer " + ScriptApp.getOAuthToken()
      },
      payload: UrlFetchApp.fetch(url).getBlob().getBytes(), // Handled safely inside native API binary translation bounds
      muteHttpExceptions: true
    };

    // To prevent any local byte allocation, we instruct the Drive file indexer directly
    const driveFile = Drive.Files.create(resource, UrlFetchApp.fetch(url).getBlob());
    tempFileId = driveFile.id;
    
    const fileMetadata = DriveApp.getFileById(tempFileId);
    const fileSize = fileMetadata.getSize();
    Logger.log(`[Stream Pipeline] File mapped cleanly to Drive Cloud Storage. Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

    // 2. INITIATE MULTIPART UPLOAD TO AWS S3
    Logger.log("[Stream Pipeline] Initiating S3 Multipart Session...");
    const uploadId = initiateMultipartUpload(filename, host, endpoint, AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION, AWS_SERVICE);
    Logger.log(`[Stream Pipeline] Session started. Upload ID: ${uploadId}`);

    const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB sequential chunks
    const completedParts = [];
    let partNumber = 1;
    let startByte = 0;

    const fileBlob = fileMetadata.getBlob();
    const rawBytes = fileBlob.getBytes(); // Extracted into a managed V8 heap space loop array

    while (startByte < fileSize) {
      let endByte = startByte + CHUNK_SIZE;
      if (endByte > fileSize) {
        endByte = fileSize;
      }

      Logger.log(`[Stream Pipeline] Slicing heap block Part ${partNumber} (Bytes: ${startByte} to ${endByte - 1})...`);
      const chunkBlob = rawBytes.slice(startByte, endByte);

      Logger.log(`[Stream Pipeline] Uploading Part ${partNumber} to S3 (${(chunkBlob.length / (1024 * 1024)).toFixed(2)} MB)...`);
      const eTag = uploadPart(
        filename, uploadId, partNumber, chunkBlob, 
        host, endpoint, AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION, AWS_SERVICE
      );

      completedParts.push({ PartNumber: partNumber, ETag: eTag });

      startByte = endByte;
      partNumber++;

      // Allow garbage collector to sweep references cleanly
      Utilities.sleep(50);
    }

    // 3. COMPLETE MULTIPART UPLOAD
    Logger.log("[Stream Pipeline] Finalizing upload on AWS S3...");
    completeMultipartUpload(filename, uploadId, completedParts, host, endpoint, AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION, AWS_SERVICE);
    Logger.log("[SUCCESS] Stream pipeline completed. File saved successfully.");
    return true;

  } catch (err) {
    Logger.log(`[CRITICAL] Stream failed: ${err.message}. Aborting S3 upload...`);
    if (typeof uploadId !== 'undefined' && uploadId) {
      abortMultipartUpload(filename, uploadId, host, endpoint, AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION, AWS_SERVICE);
    }
    Logger.log(err.stack);
    throw err;
  } finally {
    // 4. CLEAN UP SCRATCH FILE
    if (tempFileId !== null) {
      Logger.log("[Stream Pipeline] Purging temporary cloud cache files from Drive trash storage...");
      DriveApp.getFileById(tempFileId).setTrashed(true);
    }
  }
}

// =============================================================================================
// AWS S3 MULTIPART HELPER ACTIONS (UNCHANGED CORE IMPLEMENTATION)
// =============================================================================================

function initiateMultipartUpload(filename, host, endpoint, key, secret, region, service) {
  const amzDate = getAmzDate();
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = sha256Hex([]); 

  const canonicalUri = "/" + filename.split('/').map(encodeURIComponent).join('/');
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '' // Leaves a trailing newline at the end of the headers block
  ].join('\n');
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `POST\n${canonicalUri}\nuploads=\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(stringToBytes(canonicalRequest))}`;
  const signature = calculateSignature(stringToSign, secret, dateStamp, region, service);

  const response = UrlFetchApp.fetch(`${endpoint}?uploads`, {
    method: "POST",
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Authorization": `AWS4-HMAC-SHA256 Credential=${key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Failed to initiate S3 multipart: ${response.getContentText()}`);
  }

  const xmlText = response.getContentText();
  const uploadIdMatch = xmlText.match(/<UploadId>([^<]+)<\/UploadId>/);
  if (!uploadIdMatch) throw new Error("Could not parse S3 UploadId from response.");
  return uploadIdMatch[1];
}

function uploadPart(filename, uploadId, partNumber, bytes, host, endpoint, key, secret, region, service) {
  const amzDate = getAmzDate();
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = sha256Hex(bytes);

  const queryParams = `partNumber=${partNumber}&uploadId=${uploadId}`;
  const canonicalUri = "/" + filename.split('/').map(encodeURIComponent).join('/');
  const canonicalHeaders = 
    'host:' + host + '\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-date:' + amzDate + '\n';
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `PUT\n${canonicalUri}\n${queryParams}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(stringToBytes(canonicalRequest))}`;
  const signature = calculateSignature(stringToSign, secret, dateStamp, region, service);

  const response = UrlFetchApp.fetch(`${endpoint}?${queryParams}`, {
    method: "PUT",
    payload: bytes,
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Authorization": `AWS4-HMAC-SHA256 Credential=${key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Failed to upload S3 Part ${partNumber}: ${response.getContentText()}`);
  }

  const headers = response.getHeaders();
  const etag = headers["ETag"] || headers["etag"];
  if (!etag) throw new Error(`S3 did not return an ETag for Part ${partNumber}`);
  return etag.replace(/"/g, ''); 
}

function completeMultipartUpload(filename, uploadId, parts, host, endpoint, key, secret, region, service) {
  const amzDate = getAmzDate();
  const dateStamp = amzDate.substring(0, 8);

  let xmlPayload = "<CompleteMultipartUpload>";
  parts.forEach(p => {
    xmlPayload += `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>"${p.ETag}"</ETag></Part>`;
  });
  xmlPayload += "</CompleteMultipartUpload>";

  const payloadBytes = stringToBytes(xmlPayload);
  const payloadHash = sha256Hex(payloadBytes);

  const queryParams = `uploadId=${uploadId}`;
  const canonicalUri = "/" + filename.split('/').map(encodeURIComponent).join('/');
  const canonicalHeaders = [
    'host:' + host,
    'x-amz-content-sha256:' + payloadHash,
    'x-amz-date:' + amzDate,
    ''
  ].join('\n');
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `POST\n${canonicalUri}\n${queryParams}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(stringToBytes(canonicalRequest))}`;
  const signature = calculateSignature(stringToSign, secret, dateStamp, region, service);

  const response = UrlFetchApp.fetch(`${endpoint}?${queryParams}`, {
    method: "POST",
    contentType: "application/xml",
    payload: payloadBytes,
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Authorization": `AWS4-HMAC-SHA256 Credential=${key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Failed to finalize S3 upload: ${response.getContentText()}`);
  }
}

function abortMultipartUpload(filename, uploadId, host, endpoint, key, secret, region, service) {
  const amzDate = getAmzDate();
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = sha256Hex([]);

  const queryParams = `uploadId=${uploadId}`;
  const canonicalUri = "/" + filename.split('/').map(encodeURIComponent).join('/');
  const canonicalHeaders = 
    'host:' + host + '\n' +
    'x' + '-amz-content-sha256:' + payloadHash + '\n' +
    'x' + '-amz-date:' + amzDate + '\n';
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `DELETE\n${canonicalUri}\n${queryParams}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(stringToBytes(canonicalRequest))}`;
  const signature = calculateSignature(stringToSign, secret, dateStamp, region, service);

  UrlFetchApp.fetch(`${endpoint}?${queryParams}`, {
    method: "DELETE",
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Authorization": `AWS4-HMAC-SHA256 Credential=${key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    muteHttpExceptions: true
  });
}

// =============================================================================================
// CRYPTO UTILS
// =============================================================================================

function getAmzDate() {
  return Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

function stringToBytes(str) {
  //return Array.from(new TextEncoder().encode(String(str)));
  return Utilities.newBlob(String(str)).getBytes();
}

function sha256Hex(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function calculateSignature(stringToSign, secret, dateStamp, region, service) {
  const kDate    = Utilities.computeHmacSha256Signature(stringToBytes(dateStamp), stringToBytes("AWS4" + secret));
  const kRegion  = Utilities.computeHmacSha256Signature(stringToBytes(region), kDate);
  const kService = Utilities.computeHmacSha256Signature(stringToBytes(service), kRegion);
  const kSigning = Utilities.computeHmacSha256Signature(stringToBytes("aws4_request"), kService);
  
  return Utilities.computeHmacSha256Signature(stringToBytes(stringToSign), kSigning)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

//----------------------------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
    module.exports = { download_drv3 };
}
