# MIND CI/CD Pipeline Documentation

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Repositories:**  
- [mind-jenkins-ci-pipeline](https://github.com/who-sam/mind-jenkins-ci-pipeline)
- [mind-argocd-pipeline](https://github.com/who-sam/mind-argocd-pipeline)

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [CI Pipeline (Jenkins)](#ci-pipeline-jenkins)
3. [CD Pipeline (ArgoCD)](#cd-pipeline-argocd)
4. [Docker Build Process](#docker-build-process)
5. [Security Scanning](#security-scanning)
6. [Deployment Strategies](#deployment-strategies)
7. [Rollback Procedures](#rollback-procedures)
8. [Pipeline Monitoring](#pipeline-monitoring)

---

## Pipeline Overview

### CI/CD Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Developer Workflow                        │
└──────────────────────────────────────────────────────────────────┘
                                │
                     Code Push to GitHub
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CI Pipeline (Jenkins)                         │
├──────────────────────────────────────────────────────────────────┤
│  1. GitHub Webhook Trigger                                       │
│  2. Checkout Source Code                                         │
│  3. Build Docker Images                                          │
│     ├─ Frontend (React → Nginx)                                  │
│     └─ Backend (Go → Alpine)                                     │
│  4. Security Scan (Trivy)                                        │
│  5. Push to Docker Hub                                           │
│     ├─ whosam1/notes-app-frontend:latest                         │
│     ├─ whosam1/notes-app-frontend:<git-sha>                      │
│     ├─ whosam1/notes-app-backend:latest                          │
│     └─ whosam1/notes-app-backend:<git-sha>                       │
│  6. Update Kubernetes Manifests                                  │
│  7. Commit & Push to ArgoCD Repo                                 │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                   CD Pipeline (ArgoCD)                           │
├──────────────────────────────────────────────────────────────────┤
│  1. Detect Manifest Changes                                      │
│  2. Sync with EKS Cluster                                        │
│  3. Apply Kubernetes Resources                                   │
│     ├─ Namespace                                                 │
│     ├─ Secrets                                                   │
│     ├─ PersistentVolumeClaims                                    │
│     ├─ StatefulSets (Database)                                   │
│     ├─ Deployments (Frontend, Backend)                           │
│     └─ Services (LoadBalancer)                                   │
│  4. Health Checks                                                │
│  5. Application Running ✅                                       │
└──────────────────────────────────────────────────────────────────┘
```

### Pipeline Stages Summary

| Stage | Tool | Duration | Trigger |
|-------|------|----------|---------|
| **Source Control** | GitHub | Instant | Git push |
| **Build & Test** | Jenkins | 3-5 min | Webhook |
| **Security Scan** | Trivy | 1-2 min | Post-build |
| **Image Push** | Docker Hub | 1 min | Scan pass |
| **Manifest Update** | Jenkins | 30 sec | Push success |
| **Deployment** | ArgoCD | 2-3 min | Manifest change |
| **Verification** | Kubernetes | 1 min | Deploy complete |

**Total Pipeline Time:** 8-12 minutes (code to production)

---

## CI Pipeline (Jenkins)

### Jenkins Configuration

**System Requirements:**
- Jenkins 2.400+
- Docker installed on Jenkins agent
- GitHub plugin
- Docker Pipeline plugin
- Git plugin

**Required Credentials:**
```
ID                      Type            Description
dockerhub-credentials   Username/Pass   Docker Hub authentication
github-token            Secret Text     GitHub API token
```

### Jenkinsfile (mind-jenkins-ci-pipeline)

```groovy
pipeline {
    agent any
    
    environment {
        DOCKER_HUB_REPO_FRONTEND = 'whosam1/notes-app-frontend'
        DOCKER_HUB_REPO_BACKEND = 'whosam1/notes-app-backend'
        DOCKER_HUB_CREDENTIALS = credentials('dockerhub-credentials')
        GITHUB_TOKEN = credentials('github-token')
        SOURCE_REPO = 'https://github.com/who-sam/MIND.git'
        MANIFEST_REPO = 'https://github.com/who-sam/mind-argocd-pipeline.git'
        GIT_SHORT_SHA = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
    }
    
    stages {
        stage('Checkout Source Code') {
            steps {
                echo '📥 Checking out source code...'
                git branch: 'main', url: "${SOURCE_REPO}"
            }
        }
        
        stage('Build Frontend Image') {
            steps {
                echo '🏗️ Building frontend Docker image...'
                dir('frontend') {
                    sh """
                        docker build -t ${DOCKER_HUB_REPO_FRONTEND}:${GIT_SHORT_SHA} .
                        docker tag ${DOCKER_HUB_REPO_FRONTEND}:${GIT_SHORT_SHA} ${DOCKER_HUB_REPO_FRONTEND}:latest
                    """
                }
            }
        }
        
        stage('Build Backend Image') {
            steps {
                echo '🏗️ Building backend Docker image...'
                dir('backend') {
                    sh """
                        docker build -t ${DOCKER_HUB_REPO_BACKEND}:${GIT_SHORT_SHA} .
                        docker tag ${DOCKER_HUB_REPO_BACKEND}:${GIT_SHORT_SHA} ${DOCKER_HUB_REPO_BACKEND}:latest
                    """
                }
            }
        }
        
        stage('Security Scan') {
            steps {
                echo '🔒 Scanning images for vulnerabilities...'
                sh """
                    # Install Trivy if not already installed
                    if ! command -v trivy &> /dev/null; then
                        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
                    fi
                    
                    # Scan frontend
                    trivy image --severity HIGH,CRITICAL --exit-code 0 ${DOCKER_HUB_REPO_FRONTEND}:${GIT_SHORT_SHA}
                    
                    # Scan backend
                    trivy image --severity HIGH,CRITICAL --exit-code 0 ${DOCKER_HUB_REPO_BACKEND}:${GIT_SHORT_SHA}
                """
            }
        }
        
        stage('Push Images to Docker Hub') {
            steps {
                echo '📤 Pushing images to Docker Hub...'
                sh """
                    echo ${DOCKER_HUB_CREDENTIALS_PSW} | docker login -u ${DOCKER_HUB_CREDENTIALS_USR} --password-stdin
                    
                    # Push frontend
                    docker push ${DOCKER_HUB_REPO_FRONTEND}:${GIT_SHORT_SHA}
                    docker push ${DOCKER_HUB_REPO_FRONTEND}:latest
                    
                    # Push backend
                    docker push ${DOCKER_HUB_REPO_BACKEND}:${GIT_SHORT_SHA}
                    docker push ${DOCKER_HUB_REPO_BACKEND}:latest
                    
                    docker logout
                """
            }
        }
        
        stage('Update Kubernetes Manifests') {
            steps {
                echo '📝 Updating Kubernetes manifests...'
                sh """
                    # Clone manifest repository
                    rm -rf manifest-repo
                    git clone https://${GITHUB_TOKEN}@github.com/who-sam/mind-argocd-pipeline.git manifest-repo
                    cd manifest-repo
                    
                    # Update frontend deployment
                    sed -i "s|image: ${DOCKER_HUB_REPO_FRONTEND}:.*|image: ${DOCKER_HUB_REPO_FRONTEND}:${GIT_SHORT_SHA}|g" frontend-deployment.yaml
                    
                    # Update backend deployment
                    sed -i "s|image: ${DOCKER_HUB_REPO_BACKEND}:.*|image: ${DOCKER_HUB_REPO_BACKEND}:${GIT_SHORT_SHA}|g" backend-deployment.yaml
                    
                    # Commit and push
                    git config user.name "Jenkins CI"
                    git config user.email "jenkins@mind-project.com"
                    git add frontend-deployment.yaml backend-deployment.yaml
                    git commit -m "Update image tags to ${GIT_SHORT_SHA}"
                    git push origin main
                """
            }
        }
    }
    
    post {
        success {
            echo '✅ Pipeline completed successfully!'
            echo "📦 Images tagged with: ${GIT_SHORT_SHA}"
        }
        failure {
            echo '❌ Pipeline failed!'
        }
        always {
            echo '🧹 Cleaning up...'
            sh """
                docker image prune -f
                rm -rf manifest-repo
            """
        }
    }
}
```

### Jenkins Pipeline Stages Explained

**1. Checkout Source Code**
- Clones the MIND repository
- Checks out the main branch
- Retrieves Git commit SHA for tagging

**2. Build Frontend Image**
- Changes to frontend directory
- Builds Docker image using multi-stage Dockerfile
- Tags with both Git SHA and 'latest'

**3. Build Backend Image**
- Changes to backend directory
- Builds Docker image using multi-stage Dockerfile
- Tags with both Git SHA and 'latest'

**4. Security Scan**
- Installs Trivy scanner if not present
- Scans both images for vulnerabilities
- Reports HIGH and CRITICAL issues
- Non-blocking (exit-code 0)

**5. Push Images**
- Authenticates with Docker Hub
- Pushes both tagged versions
- Cleans up local Docker credentials

**6. Update Manifests**
- Clones ArgoCD manifest repository
- Updates image tags in deployment files
- Commits and pushes changes
- Triggers ArgoCD sync

### GitHub Webhook Configuration

**Webhook URL:**
```
http://your-jenkins-url/github-webhook/
```

**Events to trigger:**
- ✅ Push events (main branch)
- ❌ Pull request events (disabled)

**Payload example:**
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "name": "MIND",
    "url": "https://github.com/who-sam/MIND"
  },
  "commits": [
    {
      "id": "abc123def456",
      "message": "Update frontend styling"
    }
  ]
}
```

---

## CD Pipeline (ArgoCD)

### ArgoCD Application Configuration

```yaml
# argocd-application.yaml
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
      prune: true      # Remove resources not in Git
      selfHeal: true   # Automatically sync on drift
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  
  revisionHistoryLimit: 10
```

### ArgoCD Sync Behavior

**Automatic Sync Enabled:**
- ArgoCD polls Git repository every 3 minutes
- Detects changes in Kubernetes manifests
- Automatically applies changes to cluster
- Self-heals if manual changes are made

**Sync Phases:**
1. **PreSync**: Execute pre-sync hooks (if any)
2. **Sync**: Apply all Kubernetes resources
3. **PostSync**: Execute post-sync hooks (if any)
4. **SyncFail**: Handle sync failures

**Health Status:**
- **Healthy**: All resources running correctly
- **Progressing**: Deployment in progress
- **Degraded**: Some resources failing
- **Suspended**: Application paused
- **Missing**: Resources not found in cluster

### ArgoCD Web UI

**Access URL:** `http://argocd-server-service:80`

**Dashboard Features:**
- Application topology visualization
- Real-time sync status
- Manual sync trigger
- Rollback to previous version
- Diff view (Git vs. Live)
- Pod logs viewer
- Resource tree

---

## Docker Build Process

### Frontend Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build production bundle
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Build Optimization:**
- Multi-stage build reduces image size
- Only production dependencies included
- Build artifacts cached
- Final image: ~25MB

### Backend Dockerfile

```dockerfile
# Build stage
FROM golang:1.23-alpine AS build

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server

# Production stage
FROM alpine:latest

# Install CA certificates
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from build stage
COPY --from=build /app/server .

# Expose port
EXPOSE 8080

CMD ["./server"]
```

**Build Optimization:**
- Multi-stage build
- Statically linked binary
- No Go runtime in production
- Final image: ~15MB

### Database Dockerfile

```dockerfile
FROM postgres:15-alpine

# Copy initialization script
COPY init.sql /docker-entrypoint-initdb.d/

# Environment variables set by Kubernetes secret
ENV POSTGRES_USER=${POSTGRES_USER}
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
ENV POSTGRES_DB=${POSTGRES_DB}

EXPOSE 5432
```

---

## Security Scanning

### Trivy Scanner Configuration

**Scan Command:**
```bash
trivy image \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  --no-progress \
  whosam1/notes-app-frontend:latest
```

**Scan Output:**
```
2025-12-01T10:30:00.000Z	INFO	Detected OS: alpine 3.18.4
2025-12-01T10:30:01.000Z	INFO	Number of language-specific files: 0
2025-12-01T10:30:01.000Z	INFO	Detecting Alpine vulnerabilities...

Total: 0 (HIGH: 0, CRITICAL: 0)
```

### Vulnerability Response

**HIGH Severity:**
- Investigate immediately
- Update base image or dependencies
- Re-run pipeline

**CRITICAL Severity:**
- Block deployment
- Emergency patch required
- Security team notification

---

## Deployment Strategies

### Rolling Update (Default)

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 1
    maxSurge: 1
```

**Process:**
1. Create 1 new pod (maxSurge: 1)
2. Wait for new pod to be ready
3. Terminate 1 old pod (maxUnavailable: 1)
4. Repeat until all pods updated

**Advantages:**
- Zero downtime
- Gradual rollout
- Easy rollback

### Blue-Green Deployment (Alternative)

```yaml
# Not currently implemented
# Blue: notes-app-v1 (current)
# Green: notes-app-v2 (new)
# Switch traffic via service selector
```

### Canary Deployment (Future)

```yaml
# Planned with Argo Rollouts
# 10% → 25% → 50% → 100%
```

---

## Rollback Procedures

### Automatic Rollback (Kubernetes)

```bash
# View deployment history
kubectl rollout history deployment/backend -n notes-app

# Rollback to previous version
kubectl rollout undo deployment/backend -n notes-app

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n notes-app
```

### ArgoCD Rollback

**Via UI:**
1. Navigate to Application
2. Click "History and Rollback"
3. Select previous version
4. Click "Rollback"

**Via CLI:**
```bash
# List sync history
argocd app history mind-notes-app

# Rollback to specific sync
argocd app rollback mind-notes-app 5
```

### Manual Image Rollback

```bash
# Update deployment to previous image
kubectl set image deployment/backend \
  backend=whosam1/notes-app-backend:abc123 \
  -n notes-app
```

---

## Pipeline Monitoring

### Jenkins Metrics

**Key Metrics:**
- Build success rate
- Average build duration
- Queue time
- Failure rate by stage

**Monitoring Tools:**
- Jenkins built-in statistics
- Prometheus metrics (with plugin)
- Grafana dashboards

### ArgoCD Monitoring

**Sync Metrics:**
- Sync duration
- Sync frequency
- Failed syncs
- Out-of-sync resources

**Health Metrics:**
- Application health status
- Resource count
- Degraded resources

### Kubernetes Monitoring

**Deployment Metrics:**
- Pod restart count
- Ready replicas
- Update strategy progress
- Rollout status

**Example Queries:**
```bash
# Check deployment status
kubectl rollout status deployment/backend -n notes-app

# View pod events
kubectl get events -n notes-app --sort-by='.lastTimestamp'

# Check pod logs
kubectl logs -f deployment/backend -n notes-app
```

---

## Troubleshooting

### Common Issues

**1. Docker Build Fails**
```
Error: npm install failed
Solution: Clear npm cache, verify package.json
```

**2. Image Push Fails**
```
Error: denied: requested access to the resource is denied
Solution: Verify Docker Hub credentials in Jenkins
```

**3. ArgoCD Won't Sync**
```
Error: cluster credentials not found
Solution: Re-authenticate ArgoCD with cluster
```

**4. Deployment Stuck**
```
Error: ImagePullBackOff
Solution: Verify image tag exists in Docker Hub
```

---

**Next Document:** [Deployment Guide](05_DEPLOYMENT_GUIDE.md)
