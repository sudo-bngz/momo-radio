# **MOMO RADIO**

This project implements a simple web radio station using **Golang**, **FFmpeg**, and **Backblaze B2** (Object Storage). It features an automated ETL pipeline for music organization and a "Serverless Edge" streaming engine that pushes HLS segments directly to cloud storage for global distribution via CDN.

## **Architecture**

The system moves from a "Pull" model to a **"Push" model**, treating the Cloud Bucket as the origin server.
<p align="center">
  <img width="30%" src="./docs/assets/pic/diagram.svg">
</p>

## **Setup**

### **1\. Prerequisites**

* **Golang** (1.20+)  
* **FFmpeg** (Must be installed on the server running the engine)  
* **Terraform** (For infrastructure)  
* **Backblaze B2 Account** (Keys and Bucket access)

### **2\. Infrastructure (Terraform)**

We use Terraform to provision three specific buckets with lifecycle rules (auto-deletion of old stream segments to save costs).

```
cd infrastructure  
terraform init  
terraform apply \-var-file="dev.tfvars"
```
This creates:

1. radio-ingest-raw: Private bucket for dropping raw files.  
2. radio-assets-files: Public bucket acting as your organized library.  
3. radio-stream-live: Public bucket where HLS segments are pushed.

### **3\. Configuration (config.yaml)**

Create a config.yaml in the root directory. **Note the use of bucket\_stream\_live**:

```yaml
b2:  
  key_id: "YOUR_B2_KEY_ID"  
  app_key: "YOUR_B2_APP_KEY"  
  endpoint: "https://s3.us-west-000.backblazeb2.com"
  region: "us-west-000"  
  bucket_ingest: "radio-ingest-raw"  
  bucket_prod: "radio-assets-files"  
  bucket_stream_live: "radio-stream-live"

server:  
  temp_dir: "./temp_processing"  
  polling_interval_seconds: 10
```
## **Components & Usage**

### **The Ingester (Organizer)**

**Role:** Cleans, normalizes, and organizes your music library.

1. **Upload:** Drop raw MP3s into the bucket\_ingest.  

2. **Run:**

```bash
   go run cmd/ingester/ingester.go
```

3. **Action:**  
   * Detects new files.  
   * Reads ID3 tags (Artist, Title, Album, Year, Genre, Publisher).  
   * Normalizes volume to **\-14 LUFS** (Streaming Standard).  
   * **Aggressively strips metadata headers** (Crucial for preventing stream glitches).  
   * Uploads to bucket\_prod sorted as: music/{Genre}/{Year}/{Label}/{Album}/{Artist}-{Title}.mp3.

### **Component B: The Radio Engine (Broadcaster)**

**Role:** Plays music, transcodes to HLS, and pushes to the edge.

1. **Run:**  
   go run cmd/radio/main.go

2. **Action:**  
   * **Smart DJ:** Randomly picks tracks from music/ and station\_id/ prefixes.  
   * **Transcoder:** Pipes audio into FFmpeg to generate .ts segments and stream.m3u8 playlist.  
   * **Race-Free Uploader:** \* Watches the local folder.  
     * Uploads .ts segments immediately upon completion.  
     * **Deletes local files** to save disk space.  
     * Updates the playlist in real-time.  
   * **Web Helper:** Starts a local web server at http://localhost:8080.

## **How to Listen**

### **Option 1: Web Player**

Open index.html in your browser.

* *Note: You must update the streamUrl inside index.html to your Cloudflare/Backblaze public URL.*

### **Option 2: VLC (Testing)**

1. Ensure the Radio Engine is running.  
2. Open **VLC Media Player**.  
3. File \-\> Open Network...  
4. Enter: http://localhost:8080/listen  
5. The local helper will 302 Redirect VLC to the live cloud stream URL.

## **Know issues**

* **FFmpeg Stuck?**

  If you see "Opening output..." but no upload logs, the input MP3 likely has corrupted headers or large album art. Solution: Re-run the file through the Ingester to strip tags.  

* **403 Forbidden?**

  Check your config.yaml. Ensure key\_id is the long Application Key ID (25 chars), not the key name.

* **Stream Stops/Glitches?**  

  Ensure you re-ingested your entire library with the latest ingester.go code. Old files with metadata headers will confuse the live transcoder.