# MIND Infrastructure Guide

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Repository:** [mind-infra-pipeline](https://github.com/who-sam/mind-infra-pipeline)

---

## Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [AWS Architecture](#aws-architecture)
3. [Terraform Structure](#terraform-structure)
4. [VPC and Networking](#vpc-and-networking)
5. [EKS Cluster Configuration](#eks-cluster-configuration)
6. [IAM and Security](#iam-and-security)
7. [Storage and Databases](#storage-and-databases)
8. [Cost Analysis](#cost-analysis)
9. [Disaster Recovery](#disaster-recovery)
10. [Infrastructure Pipeline](#infrastructure-pipeline)

---

## Infrastructure Overview

### Design Philosophy

The MIND infrastructure follows cloud-native best practices:

- **Infrastructure as Code**: All resources defined in Terraform
- **Immutable Infrastructure**: Replace rather than modify
- **High Availability**: Multi-AZ deployment
- **Security First**: Private subnets, encryption, least privilege
- **Cost Optimization**: Right-sizing and auto-scaling
- **Observability**: Comprehensive logging and monitoring

### Infrastructure Components

```
AWS Account (us-east-1)
│
├── VPC (10.0.0.0/16)
│   ├── Public Subnets (2 AZs)
│   ├── Private Subnets (2 AZs)
│   ├── Internet Gateway
│   ├── NAT Gateway (1 per AZ)
│   └── Route Tables
│
├── EKS Cluster
│   ├── Control Plane (Managed)
│   ├── Node Groups
│   │   ├── t3.medium instances
│   │   └── Auto-scaling: 3-6 nodes
│   └── Add-ons
│       ├── CoreDNS
│       ├── kube-proxy
│       └── VPC CNI
│
├── IAM
│   ├── Cluster Role
│   ├── Node Role
│   ├── OIDC Provider
│   └── Service Account Roles
│
├── Security Groups
│   ├── EKS Cluster SG
│   ├── Node SG
│   └── Database SG
│
├── Storage
│   ├── EBS Volumes (gp3)
│   └── EBS Snapshots
│
└── Monitoring
    ├── CloudWatch Logs
    ├── CloudWatch Metrics
    └── CloudTrail
```

---

## AWS Architecture

### Region and Availability Zones

**Region:** us-east-1 (N. Virginia)

**Why us-east-1?**
- Lowest latency to most US users
- Broadest service availability
- Most cost-effective region
- Best spot instance availability

**Availability Zones Used:**
- us-east-1a (Primary)
- us-east-1b (Secondary)

### Multi-AZ Deployment Strategy

```
┌────────────────────────────────────────────────────────────┐
│                    Availability Zone 1a                    │
├────────────────────────────────────────────────────────────┤
│ Public Subnet                  │ Private Subnet            │
│ 10.0.1.0/24                    │ 10.0.3.0/24               │
│                                │                           │
│ • NAT Gateway                  │ • EKS Worker Nodes (1-3)  │
│ • Load Balancer (1)            │ • Frontend Pods           │
│                                │ • Backend Pods            │
│                                │ • Database (Primary)      │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    Availability Zone 1b                    │
├────────────────────────────────────────────────────────────┤
│ Public Subnet                  │ Private Subnet            │
│ 10.0.2.0/24                    │ 10.0.4.0/24               │
│                                │                           │
│ • NAT Gateway                  │ • EKS Worker Nodes (1-3)  │
│ • Load Balancer (2)            │ • Frontend Pods           │
│                                │ • Backend Pods            │
│                                │ • Database (Standby)      │
└────────────────────────────────────────────────────────────┘
```

### Network Traffic Flow

**Inbound User Request:**
```
User → Internet Gateway → Load Balancer → Frontend Pod (Private Subnet)
                                        → Backend Pod (Private Subnet)
                                        → Database Pod (Private Subnet)
```

**Outbound Internet Access:**
```
Pod (Private Subnet) → NAT Gateway → Internet Gateway → Internet
```

---

## Terraform Structure

### Repository Layout

```
mind-infra-pipeline/
│
├── main.tf                 # Root module orchestration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── terraform.tfvars        # Variable values (gitignored)
├── provider.tf             # AWS provider configuration
├── backend.tf              # S3 backend for state
├── versions.tf             # Required provider versions
│
├── modules/
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   │
│   ├── eks/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   │
│   ├── iam/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   │
│   └── security/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── README.md
│
├── scripts/
│   ├── init.sh            # Initialize Terraform
│   ├── plan.sh            # Generate plan
│   └── destroy.sh         # Cleanup script
│
└── Jenkinsfile            # CI/CD pipeline
```

### Main Configuration (main.tf)

```hcl
terraform {
  required_version = ">= 1.0"
  
  backend "s3" {
    bucket         = "mind-terraform-state"
    key            = "eks/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "MIND"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps Team"
    }
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"
  
  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  environment         = var.environment
  project_name        = var.project_name
}

# EKS Module
module "eks" {
  source = "./modules/eks"
  
  cluster_name        = var.cluster_name
  cluster_version     = var.cluster_version
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  node_instance_types = var.node_instance_types
  desired_size        = var.desired_node_count
  min_size            = var.min_node_count
  max_size            = var.max_node_count
}

# IAM Module
module "iam" {
  source = "./modules/iam"
  
  cluster_name = module.eks.cluster_name
  oidc_provider_arn = module.eks.oidc_provider_arn
}

# Security Module
module "security" {
  source = "./modules/security"
  
  vpc_id          = module.vpc.vpc_id
  cluster_name    = module.eks.cluster_name
  allowed_ip_cidrs = var.allowed_ip_cidrs
}
```

### Variable Definitions (variables.tf)

```hcl
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "mind"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones to use"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "my-eks-project-dev-cluster"
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.31"
}

variable "node_instance_types" {
  description = "EC2 instance types for nodes"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "desired_node_count" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 3
}

variable "min_node_count" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 3
}

variable "max_node_count" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 6
}
```

---

## VPC and Networking

### VPC Configuration

**CIDR Block:** 10.0.0.0/16 (65,536 IP addresses)

**Subnet Allocation:**

| Subnet Type | CIDR | AZ | Available IPs | Purpose |
|-------------|------|----|--------------:|---------|
| Public 1 | 10.0.1.0/24 | us-east-1a | 251 | NAT, LB |
| Public 2 | 10.0.2.0/24 | us-east-1b | 251 | NAT, LB |
| Private 1 | 10.0.3.0/24 | us-east-1a | 251 | Workloads |
| Private 2 | 10.0.4.0/24 | us-east-1b | 251 | Workloads |

### VPC Module (modules/vpc/main.tf)

```hcl
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.availability_zones)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "${var.project_name}-${var.environment}-public-${count.index + 1}"
    "kubernetes.io/role/elb" = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.availability_zones)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 2)
  availability_zone = var.availability_zones[count.index]
  
  tags = {
    Name = "${var.project_name}-${var.environment}-private-${count.index + 1}"
    "kubernetes.io/role/internal-elb" = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"
  
  tags = {
    Name = "${var.project_name}-${var.environment}-nat-eip-${count.index + 1}"
  }
}

# NAT Gateways
resource "aws_nat_gateway" "main" {
  count = length(var.availability_zones)
  
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  tags = {
    Name = "${var.project_name}-${var.environment}-nat-${count.index + 1}"
  }
  
  depends_on = [aws_internet_gateway.main]
}

# Route Table: Public
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

# Route Table Associations: Public
resource "aws_route_table_association" "public" {
  count = length(var.availability_zones)
  
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Route Tables: Private
resource "aws_route_table" "private" {
  count = length(var.availability_zones)
  
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-private-rt-${count.index + 1}"
  }
}

# Route Table Associations: Private
resource "aws_route_table_association" "private" {
  count = length(var.availability_zones)
  
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
```

### Network Security

**VPC Flow Logs:**
```hcl
resource "aws_flow_log" "main" {
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id
}
```

**Network ACLs:**
- Default ACL allows all traffic
- Custom ACLs can be added for additional security layers

---

## EKS Cluster Configuration

### Cluster Specifications

**Kubernetes Version:** 1.31  
**Control Plane:** Managed by AWS (Multi-AZ)  
**Networking:** VPC CNI plugin  
**Endpoint Access:** Public and Private

### EKS Module (modules/eks/main.tf)

```hcl
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  version  = var.cluster_version
  role_arn = aws_iam_role.cluster.arn
  
  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = ["0.0.0.0/0"]
    
    security_group_ids = [aws_security_group.cluster.id]
  }
  
  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }
  
  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]
  
  depends_on = [
    aws_iam_role_policy_attachment.cluster_AmazonEKSClusterPolicy,
    aws_iam_role_policy_attachment.cluster_AmazonEKSVPCResourceController,
    aws_cloudwatch_log_group.eks
  ]
  
  tags = {
    Name = var.cluster_name
  }
}

# Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-node-group"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids
  
  instance_types = var.node_instance_types
  
  scaling_config {
    desired_size = var.desired_size
    max_size     = var.max_size
    min_size     = var.min_size
  }
  
  update_config {
    max_unavailable = 1
  }
  
  labels = {
    Environment = var.environment
    NodeGroup   = "primary"
  }
  
  tags = {
    Name = "${var.cluster_name}-node"
  }
  
  depends_on = [
    aws_iam_role_policy_attachment.node_AmazonEKSWorkerNodePolicy,
    aws_iam_role_policy_attachment.node_AmazonEKS_CNI_Policy,
    aws_iam_role_policy_attachment.node_AmazonEC2ContainerRegistryReadOnly
  ]
}

# OIDC Provider
data "tls_certificate" "cluster" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "cluster" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.cluster.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
}
```

### Node Group Configuration

**Instance Type:** t3.medium
- 2 vCPUs
- 4 GB RAM
- Up to 5 Gbps network
- EBS-optimized

**Auto-Scaling:**
- Minimum: 3 nodes
- Desired: 3 nodes
- Maximum: 6 nodes

**Capacity Planning:**

| Metric | Per Node | 3 Nodes | 6 Nodes |
|--------|----------|---------|---------|
| vCPUs | 2 | 6 | 12 |
| Memory | 4 GB | 12 GB | 24 GB |
| Pods (max) | 17 | 51 | 102 |
| Cost/month | ~$30 | ~$90 | ~$180 |

### Add-ons

```hcl
resource "aws_eks_addon" "coredns" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "coredns"
  addon_version = "v1.11.1-eksbuild.4"
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "kube-proxy"
  addon_version = "v1.31.0-eksbuild.1"
}

resource "aws_eks_addon" "vpc_cni" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "vpc-cni"
  addon_version = "v1.18.1-eksbuild.1"
}
```

---

## IAM and Security

### IAM Roles

**1. Cluster Role**
```hcl
resource "aws_iam_role" "cluster" {
  name = "${var.cluster_name}-cluster-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}
```

**2. Node Role**
```hcl
resource "aws_iam_role" "node" {
  name = "${var.cluster_name}-node-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "node_AmazonEKSWorkerNodePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node.name
}
```

### Security Groups

**Cluster Security Group:**
```hcl
resource "aws_security_group" "cluster" {
  name        = "${var.cluster_name}-cluster-sg"
  description = "EKS cluster security group"
  vpc_id      = var.vpc_id
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "${var.cluster_name}-cluster-sg"
  }
}
```

### Encryption

**KMS Key for EKS:**
```hcl
resource "aws_kms_key" "eks" {
  description             = "EKS Secret Encryption Key"
  deletion_window_in_days = 10
  enable_key_rotation     = true
}
```

---

## Storage and Databases

### EBS Volumes

**Storage Class:**
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
```

**PostgreSQL PVC:**
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: gp3
  resources:
    requests:
      storage: 10Gi
```

---

## Cost Analysis

### Monthly Cost Breakdown (Dev Environment)

| Resource | Quantity | Unit Cost | Monthly Cost |
|----------|----------|-----------|--------------|
| **EKS Cluster** | 1 | $73/month | $73.00 |
| **t3.medium Nodes** | 3 | $30.37/month | $91.11 |
| **NAT Gateways** | 2 | $32.85/month | $65.70 |
| **EBS gp3 (10GB)** | 1 | $0.80/month | $0.80 |
| **Load Balancer** | 1 | $16.20/month | $16.20 |
| **Data Transfer** | Varies | ~$10/month | $10.00 |
| | | **Total** | **~$256.81/month** |

### Cost Optimization Strategies

1. **Use Spot Instances** for non-critical workloads (60-90% savings)
2. **Reserved Instances** for production (up to 72% savings)
3. **Single NAT Gateway** in dev environments
4. **Auto-scaling** to match demand
5. **S3 Lifecycle** policies for old backups

---

## Disaster Recovery

### Backup Strategy

**Infrastructure:**
- Terraform state backed up to S3
- State versioning enabled
- DynamoDB state locking

**Data:**
- Daily database snapshots
- Point-in-time recovery enabled
- Cross-region replication (production)

### Recovery Procedures

**Infrastructure Recovery:**
```bash
# Restore from Terraform state
terraform init
terraform plan
terraform apply
```

**Data Recovery:**
```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier restored-db \
  --db-snapshot-identifier snapshot-id
```

---

## Infrastructure Pipeline

### Jenkinsfile

```groovy
pipeline {
    agent any
    
    parameters {
        choice(name: 'ACTION', choices: ['plan', 'apply', 'destroy'], description: 'Terraform action')
        booleanParam(name: 'AUTO_APPROVE', defaultValue: false, description: 'Auto-approve apply')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Terraform Init') {
            steps {
                sh 'terraform init'
            }
        }
        
        stage('Terraform Plan') {
            steps {
                sh 'terraform plan -out=tfplan'
            }
        }
        
        stage('Approval') {
            when {
                expression { params.ACTION == 'apply' && !params.AUTO_APPROVE }
            }
            steps {
                input message: 'Apply Terraform changes?'
            }
        }
        
        stage('Terraform Apply') {
            when {
                expression { params.ACTION == 'apply' }
            }
            steps {
                sh 'terraform apply tfplan'
            }
        }
    }
}
```

---

**Next Document:** [Application Architecture](03_APPLICATION_ARCHITECTURE.md)
