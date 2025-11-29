# MIND - Multi-Pod Note Management Application

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.31-blue.svg)](https://kubernetes.io/)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8.svg)](https://golang.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB.svg)](https://reactjs.org/)

> A fully containerized, production-ready note management application deployed on AWS EKS with complete CI/CD automation.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Complete Pipeline Flow](#complete-pipeline-flow)
- [Quick Start](#quick-start)
- [Team Members](#team-members)
- [License](#license)

---

## 🎯 Project Overview

**MIND** is a comprehensive DevOps demonstration project showcasing modern cloud-native application deployment practices. It features:

- **Full-Stack Application**: React frontend + Go backend + PostgreSQL database
- **Infrastructure as Code**: Terraform-managed AWS EKS cluster
- **Complete CI/CD**: Jenkins → Docker Hub → ArgoCD → Kubernetes
- **Production-Ready**: Multi-AZ deployment, encryption, monitoring, and scalability

### Key Features

✅ **Secure Authentication** - JWT-based user authentication with bcrypt  
✅ **Note Management** - Create, edit, delete, and organize notes  
✅ **Rich UI** - 5 color themes, 4 status types, search, and starred notes  
✅ **Containerized** - Docker multi-stage builds for optimized images  
✅ **Scalable** - Kubernetes auto-scaling and load balancing  
✅ **Observable** - CloudWatch logging and Prometheus metrics  

---

## 🏗️ Architecture

### High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                      AWS Cloud (us-east-1)                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Amazon EKS Cluster (Kubernetes 1.31)       │  │
│  │                                                         │  │
│  │  ┌──────────────────┐  ┌──────────────────┐             │  │
│  │  │  Frontend Pods   │  │  Backend Pods    │             │  │
│  │  │  (React + Nginx) │  │  (Go + Gin)      │             │  │
│  │  │  Replicas: 2     │  │  Replicas: 2     │             │  │
│  │  └────────┬─────────┘  └────────┬─────────┘             │  │
│  │           │                     │                       │  │
│  │  ┌────────▼─────────────────────▼────────┐              │  │
│  │  │     Load Balancer (AWS ELB)           │              │  │
│  │  └────────┬──────────────────────────────┘              │  │
│  │           │                                             │  │
│  │  ┌────────▼─────────────────┐                           │  │
│  │  │  PostgreSQL StatefulSet  │                           │  │
│  │  │  Persistent Volume (EBS) │                           │  │
│  │  └──────────────────────────┘                           │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  VPC (10.0.0.0/16)                                      │  │
│  │  ├─ Public Subnets (us-east-1a, us-east-1b)             │  │
│  │  ├─ Private Subnets (us-east-1a, us-east-1b)            │  │
│  │  ├─ NAT Gateway                                         │  │
│  │  └─ Internet Gateway                                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Application Architecture

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Frontend   │──────▶│   Backend    │──────▶│  PostgreSQL  │
│  React 18.2  │ HTTP  │  Go 1.23     │  SQL  │     15       │
│  Vite Build  │       │  Gin REST    │       │   Database   │
│  Port: 80    │       │  Port: 8080  │       │  Port: 5432  │
└──────────────┘       └──────────────┘       └──────────────┘
       │                      │                      │
       │                      │                      │
       └──────────────────────┴──────────────────────┘
                    Kubernetes Services
```

---

## 🛠️ Technology Stack

### Infrastructure & DevOps
| Tool | Version | Purpose |
|------|---------|---------|
| **Terraform** | 1.0+ | Infrastructure as Code |
| **AWS EKS** | 1.31 | Managed Kubernetes |
| **Jenkins** | Latest | CI/CD Automation |
| **ArgoCD** | Latest | GitOps Deployment |
| **Docker** | Latest | Containerization |

### Application Stack
| Component | Technology | Version |
|-----------|------------|---------|
| **Frontend** | React + Vite | 18.2 |
| **Backend** | Go + Gin | 1.23 |
| **Database** | PostgreSQL | 15 |
| **Auth** | JWT + bcrypt | Latest |
| **Styling** | Tailwind CSS | Latest |

### AWS Services
- **EKS** - Kubernetes control plane
- **VPC** - Network isolation (10.0.0.0/16)
- **EC2** - Worker nodes (t3.medium)
- **EBS** - Persistent storage
- **ELB** - Load balancing
- **CloudWatch** - Logging & monitoring
- **KMS** - Encryption keys
- **S3** - Terraform state storage

---

## 📁 Repository Structure

This project is organized into **four separate repositories**:

```
MIND Project
├── 1. mind-source-code/          # Application source code
│   ├── frontend/                 # React application
│   ├── backend/                  # Go API server
│   └── docker-compose.yml        # Local development
│
├── 2. mind-infra-pipeline/       # Terraform infrastructure
│   ├── modules/                  # VPC, EKS, IAM, Security
│   ├── main.tf                   # Root orchestration
│   └── Jenkinsfile               # Infrastructure pipeline
│
├── 3. mind-ci-pipeline/          # Application CI/CD
│   ├── Jenkinsfile               # Build & push to Docker Hub
│   └── README.md                 # CI pipeline docs
│
└── 4. mind-argocd-pipeline/      # GitOps manifests
    ├── *.yaml                    # Kubernetes manifests
    └── README.md                 # Deployment docs
```

### Repository Links

| Repository | Description | URL |
|------------|-------------|-----|
| **Source Code** | Frontend + Backend + Database | [github.com/who-sam/MIND](https://github.com/who-sam/MIND) |
| **Infrastructure** | Terraform EKS provisioning | [github.com/who-sam/mind-infra-pipeline](https://github.com/who-sam/mind-infra-pipeline) |
| **CI Pipeline** | Jenkins build automation | [github.com/who-sam/mind-ci-pipeline](https://github.com/who-sam/mind-ci-pipeline) |
| **ArgoCD Pipeline** | Kubernetes manifests | [github.com/who-sam/mind-argocd-pipeline](https://github.com/who-sam/mind-argocd-pipeline) |

---

## 🔄 Complete Pipeline Flow

### Full Deployment Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT PHASE                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                        Developer pushes code to GitHub
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE PROVISIONING                         │
│                   (mind-infra-pipeline repository)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  1. GitHub Push Trigger → Jenkins Pipeline                              │
│  2. Terraform Init → Terraform Plan                                     │
│  3. Terraform Apply (Manual Approval)                                   │
│  4. AWS EKS Cluster Created:                                            │
│     ├─ VPC with public/private subnets                                  │
│     ├─ EKS Control Plane (Kubernetes 1.31)                              │
│     ├─ Node Groups (t3.medium, auto-scaling 3-6)                        │
│     ├─ IAM Roles & Security Groups                                      │
│     ├─ KMS Encryption                                                   │
│     └─ CloudWatch Logging                                               │
│  5. Cluster Ready ✅                                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      APPLICATION BUILD & PUSH                           │
│                    (mind-ci-pipeline repository)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  1. GitHub Push Trigger → Jenkins Pipeline                              │
│  2. Checkout Source Code (from MIND repo)                               │
│  3. Build Docker Images:                                                │
│     ├─ Frontend: React build → Nginx                                    │
│     └─ Backend: Go compile → Alpine                                     │
│  4. Security Scan (Trivy)                                               │
│  5. Push to Docker Hub:                                                 │
│     ├─ whosam1/notes-app-frontend:latest                                │
│     ├─ whosam1/notes-app-frontend:<git-sha>                             │
│     ├─ whosam1/notes-app-backend:latest                                 │
│     └─ whosam1/notes-app-backend:<git-sha>                              │
│  6. Update Kubernetes Manifests (mind-argocd-pipeline)                  │
│  7. Git Commit & Push Updated Manifests                                 │
│  8. Images Ready ✅                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       GITOPS DEPLOYMENT                                 │
│                  (mind-argocd-pipeline repository)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  1. ArgoCD Detects Manifest Changes                                     │
│  2. Sync Application to EKS Cluster:                                    │
│     ├─ Create Namespace: notes-app                                      │
│     ├─ Apply Secrets (DB credentials, JWT)                              │
│     ├─ Create PVC for PostgreSQL (10Gi gp3)                             │
│     ├─ Deploy PostgreSQL StatefulSet                                    │
│     ├─ Deploy Backend Deployment (2 replicas)                           │
│     ├─ Deploy Frontend Deployment (2 replicas)                          │
│     ├─ Create Services (LoadBalancer)                                   │
│     └─ Wait for Pods to be Ready                                        │
│  3. Health Checks:                                                      │
│     ├─ PostgreSQL: pg_isready                                           │
│     ├─ Backend: HTTP /api/health                                        │
│     └─ Frontend: HTTP /                                                 │
│  4. LoadBalancer DNS Assigned                                           │
│  5. Application Live ✅                                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION RUNNING                               │
└─────────────────────────────────────────────────────────────────────────┘
       │                            │                            │
       ▼                            ▼                            ▼
  Users Access                 Monitoring                   Auto-Scaling
  Application              CloudWatch Logs              Kubernetes HPA
  via ELB DNS              Prometheus Metrics           Node Auto-Scaling
```

### Pipeline Stages Breakdown

#### **Stage 1: Infrastructure (Terraform)**
```bash
# Repository: mind-infra-pipeline
Time: ~15-20 minutes
Steps:
  1. terraform init
  2. terraform plan
  3. terraform apply (requires approval)
  4. AWS resources created
  5. kubectl configured
```

#### **Stage 2: CI Build (Jenkins)**
```bash
# Repository: mind-ci-pipeline
Time: ~5-7 minutes
Steps:
  1. Git checkout
  2. Docker build (frontend + backend)
  3. Trivy security scan
  4. Docker push to Hub
  5. Update manifests
  6. Git commit & push
```

#### **Stage 3: CD Deploy (ArgoCD)**
```bash
# Repository: mind-argocd-pipeline
Time: ~3-5 minutes
Steps:
  1. ArgoCD sync triggered
  2. Apply Kubernetes manifests
  3. Rolling update deployments
  4. Health checks pass
  5. Application ready
```

**Total Time: ~25-35 minutes** (first deployment)  
**Subsequent Updates: ~8-12 minutes** (CI + CD only)

---

## 🚀 Quick Start

### Prerequisites

- AWS Account with admin access
- AWS CLI configured
- Terraform 1.0+
- kubectl
- Docker & Docker Hub account
- Jenkins server
- ArgoCD installed on cluster
- Git

### Step 1: Deploy Infrastructure

```bash
# Clone infrastructure repository
git clone https://github.com/who-sam/mind-infra-pipeline.git
cd mind-infra-pipeline

# Configure AWS credentials
aws configure

# Initialize Terraform
terraform init

# Create infrastructure
terraform plan
terraform apply

# Configure kubectl
aws eks update-kubeconfig --region us-east-1 --name my-eks-project-dev-cluster
```

### Step 2: Setup CI Pipeline

```bash
# 1. Configure Jenkins credentials:
#    - dockerhub-credentials (username + password)
#    - github-token (for manifest updates)

# 2. Create Jenkins pipeline job from:
git clone https://github.com/who-sam/mind-ci-pipeline.git

# 3. Configure webhook on MIND repository
```

### Step 3: Deploy with ArgoCD

```bash
# Clone manifests repository
git clone https://github.com/who-sam/mind-argocd-pipeline.git

# Create ArgoCD application
kubectl apply -f argocd-application.yaml

# Or via ArgoCD UI:
argocd app create notes-app \
  --repo https://github.com/who-sam/mind-argocd-pipeline.git \
  --path . \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace notes-app \
  --sync-policy automated
```

### Step 4: Access Application

```bash
# Get LoadBalancer URL
kubectl get svc -n notes-app frontend-service

# Expected output:
# NAME               TYPE           EXTERNAL-IP
# frontend-service   LoadBalancer   a1b2c3...us-east-1.elb.amazonaws.com

# Access at: http://<EXTERNAL-IP>
# Login: demo@example.com / demo123456
```

---

## 📚 Documentation

### Repository-Specific READMEs

Each repository contains detailed documentation:

- **[Source Code README](https://github.com/who-sam/MIND/blob/main/README.md)** - Application setup, API docs
- **[Infrastructure README](https://github.com/who-sam/mind-infra-pipeline/blob/main/README.md)** - Terraform modules, AWS setup
- **[CI Pipeline README](https://github.com/who-sam/mind-ci-pipeline/blob/main/README.md)** - Jenkins configuration
- **[ArgoCD README](https://github.com/who-sam/mind-argocd-pipeline/blob/main/README.md)** - Kubernetes manifests

### Additional Docs

- [QUICKSTART.md](QUICKSTART.md) - Fastest way to get started
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Technical deep dive
- [CLAUDE.md](CLAUDE.md) - AI assistant guide

---

## 🔒 Security Features

- ✅ JWT authentication with bcrypt password hashing
- ✅ HTTPS/TLS encryption in transit
- ✅ KMS encryption at rest (EKS secrets)
- ✅ Network isolation (private subnets for workloads)
- ✅ Security group whitelisting
- ✅ IAM least-privilege roles
- ✅ Container image scanning (Trivy)
- ✅ Kubernetes RBAC

---

## 📊 Monitoring & Observability

- **CloudWatch Logs** - EKS control plane logs
- **CloudWatch Metrics** - Node & pod metrics
- **Prometheus** - Application metrics (planned)
- **Grafana** - Visualization dashboards (planned)
- **Health Checks** - Liveness & readiness probes

---

## 🧪 Testing

### Local Development
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Access at http://localhost:3000
```

### Kubernetes Testing
```bash
# Check pod status
kubectl get pods -n notes-app

# View logs
kubectl logs -f deployment/backend -n notes-app

# Test API
kubectl port-forward svc/backend-service 8080:8080 -n notes-app
curl http://localhost:8080/api/health
```

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
