# MIND Deployment Guide

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Target Audience:** DevOps Engineers, System Administrators

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Infrastructure Deployment](#infrastructure-deployment)
4. [Jenkins Configuration](#jenkins-configuration)
5. [ArgoCD Setup](#argocd-setup)
6. [Application Deployment](#application-deployment)
7. [Verification](#verification)
8. [Post-Deployment Tasks](#post-deployment-tasks)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

Install the following tools on your local machine:

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Verify Installations

```bash
aws --version          # AWS CLI 2.x+
terraform --version    # Terraform v1.6.0+
kubectl version --client  # v1.31+
helm version           # v3.x+
docker --version       # Docker version 24.x+
```

### AWS Account Setup

**Required Permissions:**
- EC2 (full access)
- VPC (full access)
- EKS (full access)
- IAM (create roles/policies)
- S3 (for Terraform state)
- DynamoDB (for state locking)

**Configure AWS CLI:**
```bash
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: us-east-1
# Default output format: json
```

**Verify AWS Access:**
```bash
aws sts get-caller-identity
```

### GitHub Accounts

You need access to these repositories:
- `who-sam/MIND` (source code)
- `who-sam/mind-infra-pipeline` (infrastructure)
- `who-sam/mind-jenkins-ci-pipeline` (CI pipeline)
- `who-sam/mind-argocd-pipeline` (CD manifests)

### Docker Hub Account

Create account at [hub.docker.com](https://hub.docker.com) and note your:
- Username
- Password/Access Token

---

## Initial Setup

### Step 1: Clone Repositories

```bash
# Create project directory
mkdir -p ~/mind-project
cd ~/mind-project

# Clone all repositories
git clone https://github.com/who-sam/MIND.git
git clone https://github.com/who-sam/mind-infra-pipeline.git
git clone https://github.com/who-sam/mind-jenkins-ci-pipeline.git
git clone https://github.com/who-sam/mind-argocd-pipeline.git

# Verify
ls -la
# Should show: MIND  mind-infra-pipeline  mind-jenkins-ci-pipeline  mind-argocd-pipeline
```

### Step 2: Configure Environment Variables

Create `.env` file for local development:

```bash
cat > ~/mind-project/.env << 'EOF'
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012  # Replace with your account ID

# EKS Configuration
CLUSTER_NAME=my-eks-project-dev-cluster
NODE_INSTANCE_TYPE=t3.medium
MIN_NODES=3
MAX_NODES=6

# Database Configuration
POSTGRES_USER=notesapp
POSTGRES_PASSWORD=securepassword123  # Change this!
POSTGRES_DB=notesdb

# Backend Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this  # Change this!

# Docker Hub
DOCKER_USERNAME=whosam1
DOCKER_REPO_FRONTEND=whosam1/notes-app-frontend
DOCKER_REPO_BACKEND=whosam1/notes-app-backend
EOF

# Source the file
source ~/mind-project/.env
```

### Step 3: Create S3 Backend for Terraform

```bash
# Create S3 bucket for state
aws s3api create-bucket \
    --bucket mind-terraform-state-${AWS_ACCOUNT_ID} \
    --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket mind-terraform-state-${AWS_ACCOUNT_ID} \
    --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
    --bucket mind-terraform-state-${AWS_ACCOUNT_ID} \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }'

# Create DynamoDB table for state locking
aws dynamodb create-table \
    --table-name terraform-state-lock \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-east-1
```

---

## Infrastructure Deployment

### Step 1: Configure Terraform Backend

```bash
cd ~/mind-project/mind-infra-pipeline

# Update backend.tf with your bucket name
cat > backend.tf << EOF
terraform {
  backend "s3" {
    bucket         = "mind-terraform-state-${AWS_ACCOUNT_ID}"
    key            = "eks/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
EOF
```

### Step 2: Initialize Terraform

```bash
terraform init

# Expected output:
# Initializing the backend...
# Successfully configured the backend "s3"!
# Terraform has been successfully initialized!
```

### Step 3: Review and Customize Variables

```bash
# Create terraform.tfvars
cat > terraform.tfvars << EOF
aws_region          = "us-east-1"
environment         = "dev"
project_name        = "mind"
vpc_cidr            = "10.0.0.0/16"
availability_zones  = ["us-east-1a", "us-east-1b"]
cluster_name        = "my-eks-project-dev-cluster"
cluster_version     = "1.31"
node_instance_types = ["t3.medium"]
desired_node_count  = 3
min_node_count      = 3
max_node_count      = 6
EOF
```

### Step 4: Plan Infrastructure

```bash
terraform plan -out=tfplan

# Review the plan carefully
# Expected resources: ~40-50 resources to create
```

### Step 5: Apply Infrastructure

```bash
terraform apply tfplan

# This will take 15-20 minutes
# Progress indicators:
# - Creating VPC and subnets
# - Creating EKS cluster
# - Creating node groups
# - Configuring security groups
```

**Expected Output:**
```
Apply complete! Resources: 47 added, 0 changed, 0 destroyed.

Outputs:
cluster_endpoint = "https://XXXXXXXXXXXX.gr7.us-east-1.eks.amazonaws.com"
cluster_name = "my-eks-project-dev-cluster"
cluster_security_group_id = "sg-0123456789abcdef0"
vpc_id = "vpc-0123456789abcdef0"
```

### Step 6: Configure kubectl

```bash
# Update kubeconfig
aws eks update-kubeconfig \
    --region us-east-1 \
    --name my-eks-project-dev-cluster

# Verify cluster access
kubectl get nodes

# Expected output:
# NAME                          STATUS   ROLES    AGE   VERSION
# ip-10-0-3-123.ec2.internal    Ready    <none>   5m    v1.31.0
# ip-10-0-3-124.ec2.internal    Ready    <none>   5m    v1.31.0
# ip-10-0-4-125.ec2.internal    Ready    <none>   5m    v1.31.0
```

---

## Jenkins Configuration

### Step 1: Deploy Jenkins on EKS

```bash
# Create jenkins namespace
kubectl create namespace jenkins

# Add Jenkins Helm repository
helm repo add jenkins https://charts.jenkins.io
helm repo update

# Create values file
cat > jenkins-values.yaml << 'EOF'
controller:
  serviceType: LoadBalancer
  installPlugins:
    - kubernetes:latest
    - workflow-aggregator:latest
    - git:latest
    - configuration-as-code:latest
    - docker-workflow:latest
    - github:latest
  resources:
    requests:
      cpu: "500m"
      memory: "1Gi"
    limits:
      cpu: "2000m"
      memory: "4Gi"
  
persistence:
  enabled: true
  size: 20Gi
EOF

# Install Jenkins
helm install jenkins jenkins/jenkins \
    --namespace jenkins \
    --values jenkins-values.yaml

# Wait for deployment
kubectl wait --for=condition=ready pod \
    -l app.kubernetes.io/instance=jenkins \
    -n jenkins \
    --timeout=300s
```

### Step 2: Access Jenkins

```bash
# Get LoadBalancer URL
kubectl get svc -n jenkins jenkins

# Get admin password
kubectl exec -n jenkins -it svc/jenkins -c jenkins -- \
    cat /run/secrets/additional/chart-admin-password && echo
```

**Access Jenkins:**
- URL: `http://<EXTERNAL-IP>:8080`
- Username: `admin`
- Password: (from command above)

### Step 3: Configure Jenkins Credentials

**In Jenkins UI:**

1. Navigate to: Manage Jenkins → Credentials → System → Global credentials

2. Add Docker Hub credentials:
   - Kind: Username with password
   - ID: `dockerhub-credentials`
   - Username: Your Docker Hub username
   - Password: Your Docker Hub password

3. Add GitHub token:
   - Kind: Secret text
   - ID: `github-token`
   - Secret: Your GitHub personal access token

### Step 4: Create Jenkins Pipeline

1. Click "New Item"
2. Enter name: `mind-ci-pipeline`
3. Select "Pipeline"
4. Under "Pipeline", select "Pipeline script from SCM"
5. SCM: Git
6. Repository URL: `https://github.com/who-sam/mind-jenkins-ci-pipeline.git`
7. Branch: `*/main`
8. Script Path: `Jenkinsfile`
9. Save

### Step 5: Configure GitHub Webhook

**In GitHub Repository (MIND):**

1. Go to Settings → Webhooks → Add webhook
2. Payload URL: `http://<JENKINS-LB-URL>:8080/github-webhook/`
3. Content type: `application/json`
4. Events: "Just the push event"
5. Active: ✅
6. Add webhook

---

## ArgoCD Setup

### Step 1: Install ArgoCD

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods to be ready
kubectl wait --for=condition=ready pod \
    -l app.kubernetes.io/name=argocd-server \
    -n argocd \
    --timeout=300s
```

### Step 2: Expose ArgoCD Server

```bash
# Change service to LoadBalancer
kubectl patch svc argocd-server -n argocd -p '{
  "spec": {
    "type": "LoadBalancer"
  }
}'

# Get ArgoCD URL
kubectl get svc argocd-server -n argocd
```

### Step 3: Get ArgoCD Password

```bash
# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
    -o jsonpath="{.data.password}" | base64 -d && echo
```

### Step 4: Login to ArgoCD

**Via UI:**
- URL: `http://<ARGOCD-LB-URL>`
- Username: `admin`
- Password: (from command above)

**Via CLI:**
```bash
# Install ArgoCD CLI
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd

# Login
argocd login <ARGOCD-LB-URL> --username admin --password <PASSWORD>

# Change password
argocd account update-password
```

### Step 5: Configure ArgoCD Application

```bash
cd ~/mind-project/mind-argocd-pipeline

# Create application manifest
cat > argocd-application.yaml << 'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: mind-notes-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/who-sam/mind-argocd-pipeline.git
    targetRevision: main
    path: .
  destination:
    server: https://kubernetes.default.svc
    namespace: notes-app
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
EOF

# Apply application
kubectl apply -f argocd-application.yaml
```

---

## Application Deployment

### Step 1: Create Kubernetes Secrets

```bash
# Create notes-app namespace
kubectl create namespace notes-app

# Create database secret
kubectl create secret generic postgres-secret \
    --from-literal=POSTGRES_USER=notesapp \
    --from-literal=POSTGRES_PASSWORD=securepassword123 \
    --from-literal=POSTGRES_DB=notesdb \
    -n notes-app

# Create JWT secret
kubectl create secret generic jwt-secret \
    --from-literal=JWT_SECRET=your-super-secret-jwt-key \
    -n notes-app
```

### Step 2: Trigger First Deployment

```bash
# Make a commit to trigger CI pipeline
cd ~/mind-project/MIND
echo "# Deployment $(date)" >> README.md
git add README.md
git commit -m "Initial deployment"
git push origin main

# This will trigger:
# 1. Jenkins CI pipeline (builds images)
# 2. Updates ArgoCD manifests
# 3. ArgoCD syncs to cluster
```

### Step 3: Monitor Deployment

**Jenkins:**
```bash
# Watch Jenkins build
# Go to Jenkins UI → mind-ci-pipeline → Build History
```

**ArgoCD:**
```bash
# Watch ArgoCD sync
argocd app get mind-notes-app --refresh

# Or via kubectl
kubectl get pods -n notes-app -w
```

### Step 4: Wait for Pods

```bash
# Check all pods are running
kubectl get pods -n notes-app

# Expected output:
# NAME                        READY   STATUS    RESTARTS   AGE
# backend-xxxxx-xxxxx         1/1     Running   0          2m
# backend-xxxxx-xxxxx         1/1     Running   0          2m
# frontend-xxxxx-xxxxx        1/1     Running   0          2m
# frontend-xxxxx-xxxxx        1/1     Running   0          2m
# postgres-0                  1/1     Running   0          3m
```

---

## Verification

### Step 1: Check Services

```bash
# Get service details
kubectl get svc -n notes-app

# Expected output:
# NAME               TYPE           EXTERNAL-IP                    PORT(S)
# backend-service    ClusterIP      10.100.x.x                     8080/TCP
# frontend-service   LoadBalancer   a1b2c3...elb.amazonaws.com     80:30080/TCP
# postgres-service   ClusterIP      10.100.x.x                     5432/TCP
```

### Step 2: Test Backend API

```bash
# Get frontend LoadBalancer URL
FRONTEND_URL=$(kubectl get svc frontend-service -n notes-app -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test health endpoint
curl http://${FRONTEND_URL}/health

# Expected: {"status":"healthy"}
```

### Step 3: Access Application

```bash
# Get URL
echo "Application URL: http://${FRONTEND_URL}"

# Open in browser
# Should see login page
```

### Step 4: Test Application

1. **Register new user:**
   - Email: test@example.com
   - Password: Test123456!

2. **Login with credentials**

3. **Create a test note:**
   - Title: "First Note"
   - Content: "This is a test"
   - Color: Blue
   - Status: Pending

4. **Verify note appears in list**

---

## Post-Deployment Tasks

### Security Hardening

```bash
# 1. Rotate secrets
kubectl delete secret postgres-secret -n notes-app
kubectl create secret generic postgres-secret \
    --from-literal=POSTGRES_USER=notesapp \
    --from-literal=POSTGRES_PASSWORD=NEW_STRONG_PASSWORD \
    -n notes-app

# 2. Restrict LoadBalancer access
kubectl annotate svc frontend-service \
    service.beta.kubernetes.io/aws-load-balancer-source-ranges="YOUR_IP/32" \
    -n notes-app
```

### Enable Monitoring

```bash
# Install Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --create-namespace
```

### Setup Backups

```bash
# Enable automated database snapshots
kubectl apply -f - << 'EOF'
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: notes-app
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command: ["/bin/sh"]
            args:
              - -c
              - |
                pg_dump -h postgres-service -U notesapp notesdb > /backup/db-$(date +%Y%m%d).sql
            env:
              - name: PGPASSWORD
                valueFrom:
                  secretKeyRef:
                    name: postgres-secret
                    key: POSTGRES_PASSWORD
          restartPolicy: OnFailure
EOF
```

---

## Troubleshooting

### Issue: Pods Not Starting

**Check pod status:**
```bash
kubectl get pods -n notes-app
kubectl describe pod <POD_NAME> -n notes-app
```

**Common causes:**
- ImagePullBackOff: Image not found in Docker Hub
- CrashLoopBackOff: Application error
- Pending: Insufficient resources

### Issue: Can't Access Application

**Check service:**
```bash
kubectl get svc frontend-service -n notes-app
```

**Check security groups:**
```bash
# Ensure port 80 is open in EKS node security group
```

### Issue: Database Connection Failed

**Check database pod:**
```bash
kubectl logs postgres-0 -n notes-app
```

**Verify secret:**
```bash
kubectl get secret postgres-secret -n notes-app -o yaml
```

### Issue: Jenkins Build Fails

**Check Jenkins logs:**
```bash
kubectl logs -n jenkins deployment/jenkins
```

**Verify credentials:**
- Docker Hub credentials
- GitHub token

---

## Summary

You should now have:
- ✅ EKS cluster running in AWS
- ✅ Jenkins CI pipeline configured
- ✅ ArgoCD CD pipeline configured
- ✅ Application deployed and accessible
- ✅ Monitoring and backups configured

**Next Steps:**
- Review [Operations Manual](06_OPERATIONS_MANUAL.md)
- Setup [Security measures](07_SECURITY_GUIDE.md)
- Explore [API Reference](08_API_REFERENCE.md)

---

**Deployment Complete! 🎉**
