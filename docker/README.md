# **🐳 GoWebRadio Docker Deployment**

This directory contains the Docker configuration to run the **Ingester** and **Radio Engine** as isolated, lightweight containers.

The setup uses a **Multi-Stage Build** process:

1. **Builder Stage:** Compiles the Go binaries using a full Golang image.  
2. **Runtime Stage:** Deploys the binaries into a tiny Alpine Linux image (\~50MB) with FFmpeg installed.

## **✅ Prerequisites**

* **Docker** and **Docker Compose** installed on your server.  
* A valid config.yaml in the **project root** (one level up).

## **🛠️ Configuration**

### **1\. Environment Variables**

The docker-compose.yml expects your Backblaze credentials to be passed as environment variables.

Create a .env file inside this docker/ directory:

\# docker/.env  
B2\_KEY\_ID=your\_application\_key\_id\_here  
B2\_APP\_KEY=your\_application\_key\_here

### **2\. Volume Mapping**

The containers mount the config.yaml from the parent directory (../config.yaml) into /app/config.yaml inside the container.

**Ensure your config.yaml in the root folder is configured correctly before building.**

## **🚀 Running the Radio**

### **Build and Start**

Run this command from inside the docker/ directory:

docker-compose up \--build \-d

* \--build: Forces a rebuild of the Go binaries (useful if you changed code).  
* \-d: Detached mode (runs in the background).

### **View Logs**

To see what's happening (FFmpeg progress, uploads, etc.):

\# View logs for both services  
docker-compose logs \-f

\# View logs for just the radio engine  
docker-compose logs \-f radio

\# View logs for the ingester  
docker-compose logs \-f ingester

### **Stop**

To stop the radio:

docker-compose down

## **🌐 Networking**

* **Radio Engine:** Exposes port 8080 locally.  
  * **VLC Helper:** Accessible at http://localhost:8080/listen (on the host machine).  
  * *Note: Since the actual stream is pushed to the Cloud (B2), this port is only for the redirect helper.*

## **🐛 Troubleshooting**

* "exec user process caused: exec format error":  
  You might be building on an M1 Mac (ARM64) and trying to run on a Linux VPS (AMD64). Docker usually handles this, but if you have issues, check your target architecture.  
* "config.yaml: no such file or directory":  
  Ensure you are running docker-compose up from inside the docker/ folder, so the relative path ../config.yaml resolves correctly.