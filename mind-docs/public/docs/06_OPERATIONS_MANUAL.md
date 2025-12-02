# MIND Operations Manual

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Target Audience:** Operations Team, Site Reliability Engineers

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Monitoring and Alerting](#monitoring-and-alerting)
3. [Backup and Recovery](#backup-and-recovery)
4. [Scaling Operations](#scaling-operations)
5. [Incident Response](#incident-response)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Performance Tuning](#performance-tuning)
8. [Common Issues and Solutions](#common-issues-and-solutions)

---

## Daily Operations

### Morning Health Check (10 minutes)

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== MIND Application Health Check ==="
echo "Date: $(date)"
echo

# 1. Check Cluster Status
echo "1. Cluster Nodes:"
kubectl get nodes
echo

# 2. Check Application Pods
echo "2. Application Pods:"
kubectl get pods -n notes-app
echo

# 3. Check Services
echo "3. Services Status:"
kubectl get svc -n notes-app
echo

# 4. Check Persistent Volumes
echo "4. Persistent Volumes:"
kubectl get pvc -n notes-app
echo

# 5. Check Recent Events
echo "5. Recent Events (Last 1 hour):"
kubectl get events -n notes-app --sort-by='.lastTimestamp' | head -20
echo

# 6. Test Application Endpoint
echo "6. Application Health:"
FRONTEND_URL=$(kubectl get svc frontend-service -n notes-app -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
curl -s http://${FRONTEND_URL}/health && echo " ✅ Frontend Healthy" || echo " ❌ Frontend Unhealthy"
echo

# 7. Check Resource Usage
echo "7. Resource Usage:"
kubectl top nodes
kubectl top pods -n notes-app
echo

echo "=== Health Check Complete ==="
```

### Running the Health Check

```bash
# Make script executable
chmod +x daily-health-check.sh

# Run manually
./daily-health-check.sh

# Or schedule with cron (daily at 9 AM)
crontab -e
0 9 * * * /path/to/daily-health-check.sh > /var/log/mind-health-check.log 2>&1
```

### Key Metrics to Review Daily

| Metric | Threshold | Action if Exceeded |
|--------|-----------|-------------------|
| Pod Restart Count | > 5 in 24h | Investigate logs |
| Node CPU Usage | > 80% | Consider scaling |
| Node Memory Usage | > 85% | Consider scaling |
| Disk Usage | > 80% | Clean up or expand |
| Failed Requests | > 1% | Check error logs |
| Response Time | > 500ms (p95) | Performance tuning |

---

## Monitoring and Alerting

### CloudWatch Logs

**View EKS Control Plane Logs:**
```bash
# API Server logs
aws logs tail /aws/eks/my-eks-project-dev-cluster/cluster --follow

# Audit logs
aws logs tail /aws/eks/my-eks-project-dev-cluster/cluster/audit --follow
```

**View Application Logs:**
```bash
# Backend logs
kubectl logs -f deployment/backend -n notes-app

# Frontend logs
kubectl logs -f deployment/frontend -n notes-app

# Database logs
kubectl logs -f statefulset/postgres -n notes-app

# All logs from a specific pod
kubectl logs <POD_NAME> -n notes-app --tail=100
```

### Prometheus Metrics (if installed)

**Install Prometheus:**
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --create-namespace
```

**Access Prometheus:**
```bash
# Port forward to access UI
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Open: http://localhost:9090
```

**Key Queries:**

```promql
# Pod CPU usage
sum(rate(container_cpu_usage_seconds_total{namespace="notes-app"}[5m])) by (pod)

# Pod memory usage
sum(container_memory_working_set_bytes{namespace="notes-app"}) by (pod)

# HTTP request rate
rate(http_requests_total{namespace="notes-app"}[5m])

# Error rate
rate(http_requests_total{namespace="notes-app",status=~"5.."}[5m])
```

### Grafana Dashboards

**Install Grafana (included with Prometheus stack):**
```bash
# Get Grafana password
kubectl get secret -n monitoring prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode

# Port forward
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Open: http://localhost:3000
# Username: admin
# Password: (from command above)
```

**Recommended Dashboards:**
- Kubernetes Cluster Monitoring (ID: 7249)
- Kubernetes Deployment Monitoring (ID: 8588)
- PostgreSQL Database Monitoring (ID: 9628)

### Setting Up Alerts

**Example AlertManager Configuration:**
```yaml
# prometheus-alerts.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-alerts
  namespace: monitoring
data:
  alerts.yml: |
    groups:
    - name: mind-alerts
      interval: 30s
      rules:
      # High pod restart rate
      - alert: HighPodRestarts
        expr: rate(kube_pod_container_status_restarts_total{namespace="notes-app"}[15m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Pod {{ $labels.pod }} is restarting frequently"
          description: "Pod has restarted {{ $value }} times in the last 15 minutes"
      
      # High CPU usage
      - alert: HighCPUUsage
        expr: sum(rate(container_cpu_usage_seconds_total{namespace="notes-app"}[5m])) by (pod) > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.pod }}"
          description: "CPU usage is above 80%"
      
      # High memory usage
      - alert: HighMemoryUsage
        expr: sum(container_memory_working_set_bytes{namespace="notes-app"}) by (pod) / sum(container_spec_memory_limit_bytes{namespace="notes-app"}) by (pod) > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.pod }}"
          description: "Memory usage is above 85%"
      
      # Application down
      - alert: ApplicationDown
        expr: up{job="notes-app"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Application is down"
          description: "The application has been down for more than 5 minutes"
```

**Apply alerts:**
```bash
kubectl apply -f prometheus-alerts.yaml
```

---

## Backup and Recovery

### Database Backup Strategy

**Automated Daily Backups:**
```yaml
# postgres-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: notes-app
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command:
            - /bin/sh
            - -c
            - |
              BACKUP_FILE="/backup/notesdb-$(date +%Y%m%d-%H%M%S).sql"
              pg_dump -h postgres-service -U ${POSTGRES_USER} ${POSTGRES_DB} > ${BACKUP_FILE}
              
              # Upload to S3
              aws s3 cp ${BACKUP_FILE} s3://mind-backups/database/
              
              # Keep only last 7 days locally
              find /backup -name "*.sql" -mtime +7 -delete
              
              echo "Backup completed: ${BACKUP_FILE}"
            env:
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_PASSWORD
            - name: POSTGRES_DB
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_DB
            volumeMounts:
            - name: backup-volume
              mountPath: /backup
          volumes:
          - name: backup-volume
            emptyDir: {}
          restartPolicy: OnFailure
```

**Manual Backup:**
```bash
# Backup database
kubectl exec -n notes-app postgres-0 -- pg_dump -U notesapp notesdb > backup-$(date +%Y%m%d).sql

# Compress backup
gzip backup-$(date +%Y%m%d).sql

# Upload to S3
aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://mind-backups/database/manual/
```

### Database Recovery

**Restore from Backup:**
```bash
# 1. Download backup from S3
aws s3 cp s3://mind-backups/database/notesdb-20251201.sql.gz ./

# 2. Decompress
gunzip notesdb-20251201.sql.gz

# 3. Scale down application
kubectl scale deployment backend --replicas=0 -n notes-app
kubectl scale deployment frontend --replicas=0 -n notes-app

# 4. Drop and recreate database
kubectl exec -n notes-app postgres-0 -- psql -U notesapp -c "DROP DATABASE notesdb;"
kubectl exec -n notes-app postgres-0 -- psql -U notesapp -c "CREATE DATABASE notesdb;"

# 5. Restore backup
kubectl exec -i -n notes-app postgres-0 -- psql -U notesapp notesdb < notesdb-20251201.sql

# 6. Scale up application
kubectl scale deployment backend --replicas=2 -n notes-app
kubectl scale deployment frontend --replicas=2 -n notes-app

# 7. Verify
kubectl get pods -n notes-app
```

### Kubernetes Configuration Backup

```bash
# Backup all Kubernetes resources
kubectl get all --all-namespaces -o yaml > k8s-backup-$(date +%Y%m%d).yaml

# Backup specific namespace
kubectl get all -n notes-app -o yaml > notes-app-backup-$(date +%Y%m%d).yaml

# Backup secrets
kubectl get secrets -n notes-app -o yaml > secrets-backup-$(date +%Y%m%d).yaml

# Encrypt and store
tar -czf k8s-backup-$(date +%Y%m%d).tar.gz *.yaml
gpg --symmetric --cipher-algo AES256 k8s-backup-$(date +%Y%m%d).tar.gz
aws s3 cp k8s-backup-$(date +%Y%m%d).tar.gz.gpg s3://mind-backups/kubernetes/
```

### Disaster Recovery Plan

**Recovery Time Objective (RTO):** 4 hours  
**Recovery Point Objective (RPO):** 24 hours

**DR Procedure:**
1. Provision new infrastructure (Terraform) - 20 minutes
2. Restore Kubernetes configuration - 10 minutes
3. Restore database from backup - 30 minutes
4. Deploy application - 10 minutes
5. Verify and test - 30 minutes
6. DNS update and cutover - 10 minutes

**Total:** ~2 hours (well within RTO)

---

## Scaling Operations

### Horizontal Pod Autoscaling (HPA)

**Enable metrics server:**
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

**Create HPA for Backend:**
```yaml
# backend-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: notes-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Create HPA for Frontend:**
```yaml
# frontend-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: frontend-hpa
  namespace: notes-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: frontend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Apply HPAs:**
```bash
kubectl apply -f backend-hpa.yaml
kubectl apply -f frontend-hpa.yaml

# Monitor HPA
kubectl get hpa -n notes-app -w
```

### Cluster Autoscaling

**Update node group:**
```bash
# Via Terraform
# In variables.tf, update:
min_node_count = 3
max_node_count = 10

# Apply
terraform apply

# Or via AWS CLI
aws eks update-nodegroup-config \
    --cluster-name my-eks-project-dev-cluster \
    --nodegroup-name my-eks-project-dev-cluster-node-group \
    --scaling-config minSize=3,maxSize=10,desiredSize=3
```

### Manual Scaling

**Scale deployments:**
```bash
# Scale backend
kubectl scale deployment backend --replicas=5 -n notes-app

# Scale frontend
kubectl scale deployment frontend --replicas=5 -n notes-app

# Verify
kubectl get pods -n notes-app
```

**Scale nodes:**
```bash
# Update desired capacity
aws eks update-nodegroup-config \
    --cluster-name my-eks-project-dev-cluster \
    --nodegroup-name my-eks-project-dev-cluster-node-group \
    --scaling-config desiredSize=6
```

---

## Incident Response

### Incident Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P1 (Critical)** | Complete outage | 15 minutes | Application down |
| **P2 (High)** | Major degradation | 1 hour | High error rate |
| **P3 (Medium)** | Minor degradation | 4 hours | Slow response |
| **P4 (Low)** | Minimal impact | 24 hours | UI glitch |

### Incident Response Playbook

**Step 1: Assess (5 minutes)**
```bash
# Quick assessment
./daily-health-check.sh

# Check recent changes
kubectl rollout history deployment/backend -n notes-app
kubectl rollout history deployment/frontend -n notes-app
```

**Step 2: Communicate (2 minutes)**
- Create incident ticket
- Notify stakeholders
- Update status page

**Step 3: Mitigate (varies)**
```bash
# Rollback if recent deployment
kubectl rollout undo deployment/backend -n notes-app

# Scale up if resource issue
kubectl scale deployment backend --replicas=5 -n notes-app

# Restart if hung
kubectl rollout restart deployment/backend -n notes-app
```

**Step 4: Investigate**
```bash
# Check logs
kubectl logs -n notes-app deployment/backend --tail=1000 | grep -i error

# Check events
kubectl get events -n notes-app --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n notes-app
```

**Step 5: Resolve**
- Apply fix
- Verify resolution
- Monitor stability

**Step 6: Document**
- Write post-mortem
- Update runbooks
- Implement preventions

---

## Maintenance Procedures

### Kubernetes Upgrade

```bash
# 1. Check current version
kubectl version --short

# 2. Upgrade control plane (via Terraform or AWS Console)
terraform apply -var="cluster_version=1.32"

# 3. Upgrade node groups
aws eks update-nodegroup-version \
    --cluster-name my-eks-project-dev-cluster \
    --nodegroup-name my-eks-project-dev-cluster-node-group \
    --kubernetes-version 1.32

# 4. Verify upgrade
kubectl get nodes
```

### Application Update

```bash
# 1. Update source code
cd ~/mind-project/MIND
git pull

# 2. Make changes
# ... edit files ...

# 3. Commit and push (triggers CI/CD)
git add .
git commit -m "Update: description"
git push

# 4. Monitor deployment
kubectl get pods -n notes-app -w
```

### Certificate Renewal

```bash
# Check certificate expiration
kubectl get secret -n notes-app tls-cert -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -text -noout | grep "Not After"

# Renew certificate (example with Let's Encrypt)
cert-manager renew tls-cert -n notes-app
```

---

## Performance Tuning

### Database Optimization

**PostgreSQL Configuration:**
```sql
-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Add missing indexes
CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);

-- Vacuum and analyze
VACUUM ANALYZE;

-- Update statistics
ANALYZE notes;
```

### Backend Optimization

**Increase resource limits:**
```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

### Frontend Optimization

**Enable caching:**
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Common Issues and Solutions

### Issue: ImagePullBackOff

**Diagnosis:**
```bash
kubectl describe pod <POD_NAME> -n notes-app
```

**Solutions:**
- Verify image exists in Docker Hub
- Check image tag is correct
- Verify Docker Hub credentials

### Issue: CrashLoopBackOff

**Diagnosis:**
```bash
kubectl logs <POD_NAME> -n notes-app --previous
```

**Solutions:**
- Check application logs for errors
- Verify environment variables
- Check database connectivity

### Issue: High Memory Usage

**Diagnosis:**
```bash
kubectl top pods -n notes-app
```

**Solutions:**
- Increase memory limits
- Check for memory leaks
- Enable HPA

### Issue: Slow Response Times

**Diagnosis:**
```bash
# Check database queries
kubectl exec -n notes-app postgres-0 -- psql -U notesapp -d notesdb -c "SELECT * FROM pg_stat_activity;"
```

**Solutions:**
- Add database indexes
- Enable query caching
- Scale up replicas

---

**Next Document:** [Security Guide](07_SECURITY_GUIDE.md)
