# MIND Security Guide

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Classification:** Internal Use

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Network Security](#network-security)
4. [Data Encryption](#data-encryption)
5. [Secrets Management](#secrets-management)
6. [Container Security](#container-security)
7. [Kubernetes Security](#kubernetes-security)
8. [Security Monitoring](#security-monitoring)
9. [Compliance](#compliance)
10. [Security Best Practices](#security-best-practices)

---

## Security Overview

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Security Layers                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 7: Application Security                                  │
│  ├─ JWT Authentication                                          │
│  ├─ Password Hashing (bcrypt)                                   │
│  ├─ Input Validation                                            │
│  └─ CORS Policy                                                 │
│                                                                 │
│  Layer 6: API Security                                          │
│  ├─ Rate Limiting                                               │
│  ├─ Request Validation                                          │
│  └─ Error Handling                                              │
│                                                                 │
│  Layer 5: Container Security                                    │
│  ├─ Image Scanning (Trivy)                                      │
│  ├─ Non-root Containers                                         │
│  ├─ Read-only Filesystems                                       │
│  └─ Resource Limits                                             │
│                                                                 │
│  Layer 4: Kubernetes Security                                   │
│  ├─ RBAC                                                        │
│  ├─ Network Policies                                            │
│  ├─ Pod Security Standards                                      │
│  └─ Secrets Encryption                                          │
│                                                                 │
│  Layer 3: Network Security                                      │
│  ├─ Security Groups                                             │
│  ├─ Private Subnets                                             │
│  ├─ NACLs                                                       │
│  └─ TLS/HTTPS                                                   │
│                                                                 │
│  Layer 2: Infrastructure Security                               │
│  ├─ IAM Roles & Policies                                        │
│  ├─ KMS Encryption                                              │
│  ├─ VPC Isolation                                               │
│  └─ CloudTrail Logging                                          │
│                                                                 │
│  Layer 1: Physical Security                                     │
│  └─ AWS Data Center Security                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Security Principles

1. **Defense in Depth** - Multiple layers of security
2. **Least Privilege** - Minimal permissions required
3. **Zero Trust** - Never trust, always verify
4. **Encryption Everywhere** - Data at rest and in transit
5. **Continuous Monitoring** - Real-time threat detection

---

## Authentication & Authorization

### JWT Authentication

**JWT Token Structure:**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "user_id": 123,
    "email": "user@example.com",
    "exp": 1733097600,
    "iat": 1733011200
  },
  "signature": "HMACSHA256(base64UrlEncode(header) + '.' + base64UrlEncode(payload), secret)"
}
```

**Security Features:**
- **Algorithm**: HMAC-SHA256 (secure)
- **Expiration**: 24 hours (configurable)
- **Secret**: Stored in Kubernetes Secret
- **Validation**: Every request verified

**JWT Middleware (Go):**
```go
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(401, gin.H{"error": "Authorization required"})
            c.Abort()
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            // Validate signing method
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fmt.Errorf("unexpected signing method")
            }
            return []byte(jwtSecret), nil
        })
        
        if err != nil || !token.Valid {
            c.JSON(401, gin.H{"error": "Invalid token"})
            c.Abort()
            return
        }
        
        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            c.JSON(401, gin.H{"error": "Invalid claims"})
            c.Abort()
            return
        }
        
        // Set user context
        c.Set("user_id", int(claims["user_id"].(float64)))
        c.Next()
    }
}
```

### Password Security

**Hashing Strategy:**
```go
import "golang.org/x/crypto/bcrypt"

// Hash password
func HashPassword(password string) (string, error) {
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), 10)
    return string(bytes), err
}

// Verify password
func CheckPassword(password, hash string) bool {
    err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
    return err == nil
}
```

**Password Requirements:**
- Minimum length: 8 characters
- Must contain: uppercase, lowercase, number
- Maximum attempts: 5 (before lockout)
- Lockout duration: 15 minutes

**Password Storage:**
- Algorithm: bcrypt
- Cost factor: 10 (2^10 iterations)
- Salt: Automatically generated per password
- Storage: PostgreSQL (password_hash column)

### Role-Based Access Control (RBAC)

**User Roles:**
| Role | Permissions | Use Case |
|------|------------|----------|
| **User** | CRUD own notes | Standard user |
| **Admin** | All operations | System admin |
| **ReadOnly** | View only | Auditor |

**Implementation (Future):**
```go
type Role string

const (
    RoleUser     Role = "user"
    RoleAdmin    Role = "admin"
    RoleReadOnly Role = "readonly"
)

type User struct {
    ID       int    `json:"id"`
    Email    string `json:"email"`
    Role     Role   `json:"role"`
    // ...
}
```

---

## Network Security

### VPC Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VPC (10.0.0.0/16)                        │
│                                                             │
│  ┌──────────────────┐           ┌──────────────────┐        │
│  │  Public Subnets  │           │ Private Subnets  │        │
│  │  10.0.1.0/24     │           │  10.0.3.0/24     │        │
│  │  10.0.2.0/24     │           │  10.0.4.0/24     │        │
│  │                  │           │                  │        │
│  │  • NAT Gateway   │───────────│  • EKS Nodes     │        │
│  │  • Load Balancer │           │  • Pods          │        │
│  │  • Internet GW   │           │  • Database      │        │
│  └──────────────────┘           └──────────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Security Groups

**EKS Cluster Security Group:**
```hcl
resource "aws_security_group" "eks_cluster" {
  name        = "${var.cluster_name}-cluster-sg"
  description = "EKS cluster security group"
  vpc_id      = var.vpc_id

  # Allow HTTPS from anywhere
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access to Kubernetes API"
  }

  # Allow all outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "${var.cluster_name}-cluster-sg"
  }
}
```

**Node Security Group:**
```hcl
resource "aws_security_group" "eks_nodes" {
  name        = "${var.cluster_name}-node-sg"
  description = "Security group for EKS worker nodes"
  vpc_id      = var.vpc_id

  # Allow pods to communicate with each other
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    self        = true
    description = "Allow nodes to communicate with each other"
  }

  # Allow worker nodes to receive traffic from cluster control plane
  ingress {
    from_port       = 1025
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
    description     = "Allow worker Kubelets to receive communication from cluster control plane"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "${var.cluster_name}-node-sg"
  }
}
```

**Database Security Group:**
```hcl
resource "aws_security_group" "database" {
  name        = "${var.cluster_name}-db-sg"
  description = "Security group for PostgreSQL database"
  vpc_id      = var.vpc_id

  # Allow PostgreSQL from nodes only
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
    description     = "Allow PostgreSQL access from EKS nodes"
  }

  tags = {
    Name = "${var.cluster_name}-db-sg"
  }
}
```

### Network Policies

**Deny all traffic by default:**
```yaml
# default-deny-all.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: notes-app
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

**Allow frontend to backend:**
```yaml
# frontend-to-backend.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-to-backend
  namespace: notes-app
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
```

**Allow backend to database:**
```yaml
# backend-to-database.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-to-database
  namespace: notes-app
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
```

**Apply network policies:**
```bash
kubectl apply -f default-deny-all.yaml
kubectl apply -f frontend-to-backend.yaml
kubectl apply -f backend-to-database.yaml
```

---

## Data Encryption

### Encryption at Rest

**EBS Volume Encryption:**
```hcl
resource "aws_ebs_volume" "encrypted" {
  availability_zone = "us-east-1a"
  size              = 20
  encrypted         = true
  kms_key_id        = aws_kms_key.ebs.arn
}
```

**Kubernetes Secrets Encryption:**
```hcl
resource "aws_eks_cluster" "main" {
  # ...
  
  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }
}
```

**KMS Key Configuration:**
```hcl
resource "aws_kms_key" "eks" {
  description             = "EKS Secret Encryption Key"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name = "${var.cluster_name}-eks-key"
  }
}

resource "aws_kms_alias" "eks" {
  name          = "alias/${var.cluster_name}-eks"
  target_key_id = aws_kms_key.eks.key_id
}
```

### Encryption in Transit

**TLS/HTTPS Configuration:**
```nginx
# nginx.conf
server {
    listen 80;
    server_name _;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    # SSL certificates
    ssl_certificate /etc/nginx/ssl/tls.crt;
    ssl_certificate_key /etc/nginx/ssl/tls.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }
}
```

**Database SSL Connection:**
```go
// PostgreSQL connection with SSL
connStr := fmt.Sprintf(
    "host=%s port=%s user=%s password=%s dbname=%s sslmode=require",
    host, port, user, password, dbname,
)
```

---

## Secrets Management

### Kubernetes Secrets

**Create secrets securely:**
```bash
# Database credentials
kubectl create secret generic postgres-secret \
    --from-literal=POSTGRES_USER=notesapp \
    --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 32) \
    --from-literal=POSTGRES_DB=notesdb \
    -n notes-app \
    --dry-run=client -o yaml | kubectl apply -f -

# JWT secret
kubectl create secret generic jwt-secret \
    --from-literal=JWT_SECRET=$(openssl rand -base64 64) \
    -n notes-app \
    --dry-run=client -o yaml | kubectl apply -f -

# Docker registry credentials
kubectl create secret docker-registry dockerhub-secret \
    --docker-server=https://index.docker.io/v1/ \
    --docker-username=whosam1 \
    --docker-password=${DOCKER_PASSWORD} \
    --docker-email=email@example.com \
    -n notes-app
```

**Using secrets in pods:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  template:
    spec:
      containers:
      - name: backend
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: JWT_SECRET
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: DATABASE_URL
```

### Secret Rotation

**Rotate JWT secret:**
```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 64)

# 2. Update secret
kubectl create secret generic jwt-secret \
    --from-literal=JWT_SECRET=${NEW_SECRET} \
    -n notes-app \
    --dry-run=client -o yaml | kubectl apply -f -

# 3. Rolling restart backend
kubectl rollout restart deployment/backend -n notes-app

# 4. Verify
kubectl rollout status deployment/backend -n notes-app
```

**Rotate database password:**
```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update password in PostgreSQL
kubectl exec -n notes-app postgres-0 -- psql -U notesapp -c \
    "ALTER USER notesapp WITH PASSWORD '${NEW_PASSWORD}';"

# 3. Update secret
kubectl create secret generic postgres-secret \
    --from-literal=POSTGRES_PASSWORD=${NEW_PASSWORD} \
    --dry-run=client -o yaml | kubectl apply -f -

# 4. Restart backend
kubectl rollout restart deployment/backend -n notes-app
```

---

## Container Security

### Image Scanning with Trivy

**Scan images:**
```bash
# Scan frontend
trivy image whosam1/notes-app-frontend:latest

# Scan backend
trivy image whosam1/notes-app-backend:latest

# Scan with severity filter
trivy image --severity HIGH,CRITICAL whosam1/notes-app-backend:latest

# Generate report
trivy image --format json --output report.json whosam1/notes-app-backend:latest
```

### Secure Dockerfile Practices

**Frontend Dockerfile:**
```dockerfile
FROM node:18-alpine AS build
# ✅ Use specific version
# ✅ Use Alpine for smaller size

WORKDIR /app

# ✅ Copy only necessary files
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
# ✅ Multi-stage build
# ✅ Minimal production image

# ✅ Run as non-root user
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# ✅ Read-only root filesystem
# ✅ Drop all capabilities
USER nginx

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Pod Security Standards

**Apply pod security standards:**
```yaml
# pod-security-standards.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: notes-app
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

**Secure pod configuration:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: backend
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  
  containers:
  - name: backend
    image: whosam1/notes-app-backend:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    resources:
      limits:
        cpu: "1"
        memory: "512Mi"
      requests:
        cpu: "100m"
        memory: "128Mi"
```

---

## Kubernetes Security

### RBAC Configuration

**Service Account:**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: notes-app-sa
  namespace: notes-app
```

**Role:**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: notes-app-role
  namespace: notes-app
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

**RoleBinding:**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: notes-app-binding
  namespace: notes-app
subjects:
- kind: ServiceAccount
  name: notes-app-sa
  namespace: notes-app
roleRef:
  kind: Role
  name: notes-app-role
  apiGroup: rbac.authorization.k8s.io
```

### Audit Logging

**Enable EKS audit logs:**
```hcl
resource "aws_eks_cluster" "main" {
  # ...
  
  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]
}
```

**View audit logs:**
```bash
# CloudWatch Logs
aws logs tail /aws/eks/my-eks-project-dev-cluster/cluster/audit --follow

# Filter for failed authentication
aws logs filter-log-events \
    --log-group-name /aws/eks/my-eks-project-dev-cluster/cluster/audit \
    --filter-pattern "responseStatus.code=401"
```

---

## Security Monitoring

### CloudWatch Alarms

**Failed authentication attempts:**
```hcl
resource "aws_cloudwatch_log_metric_filter" "failed_auth" {
  name           = "failed-auth-attempts"
  log_group_name = "/aws/eks/${var.cluster_name}/cluster/audit"
  pattern        = "[... responseStatus.code=401 ...]"

  metric_transformation {
    name      = "FailedAuthAttempts"
    namespace = "EKS/Security"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "failed_auth_alarm" {
  alarm_name          = "${var.cluster_name}-failed-auth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FailedAuthAttempts"
  namespace           = "EKS/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert on multiple failed authentication attempts"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

### Security Scanning

**Automated vulnerability scanning:**
```yaml
# security-scan-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: security-scan
  namespace: notes-app
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: trivy
            image: aquasec/trivy:latest
            command:
            - /bin/sh
            - -c
            - |
              trivy image --severity HIGH,CRITICAL whosam1/notes-app-frontend:latest
              trivy image --severity HIGH,CRITICAL whosam1/notes-app-backend:latest
          restartPolicy: OnFailure
```

---

## Compliance

### GDPR Compliance

- ✅ Data encryption at rest and in transit
- ✅ User consent for data processing
- ✅ Right to access personal data
- ✅ Right to delete personal data
- ✅ Data breach notification procedures

### SOC 2 Compliance

- ✅ Access controls (RBAC, IAM)
- ✅ Encryption (KMS, TLS)
- ✅ Logging and monitoring (CloudWatch, CloudTrail)
- ✅ Change management (GitOps)
- ✅ Incident response procedures

---

## Security Best Practices

### Development

- ✅ Never commit secrets to Git
- ✅ Use environment variables
- ✅ Enable branch protection
- ✅ Require code reviews
- ✅ Scan dependencies regularly

### Operations

- ✅ Principle of least privilege
- ✅ Regular security updates
- ✅ Monitor for anomalies
- ✅ Incident response plan
- ✅ Regular backups

### Kubernetes

- ✅ Use namespaces for isolation
- ✅ Enable RBAC
- ✅ Use network policies
- ✅ Scan container images
- ✅ Run as non-root user

---

**Next Document:** [API Reference](08_API_REFERENCE.md)
