#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="$ROOT_DIR/infra/k8s"

IMAGES=(
  "dms-web:minikube"
  "dms-auth:minikube"
  "dms-gateway:minikube"
  "dms-comments:minikube"
  "dms-documents:minikube"
  "docker-audit-service:minikube"
  "docker-search-service:minikube"
  "docker-translator-service:minikube"
)

usage() {
  cat <<'EOF'
Usage:
  ./scripts/presentation_runbook.sh <command>

Commands:
  up          Start minikube, load images, deploy manifests
  status      Show deployment/pod health
  access      Print panel access instructions (WSL-friendly)
  panels      Print panel port-forward commands
  login-check Trigger auth login through gateway
  kafka-check Consume audit-topic messages from Kafka
  logs        Show key service logs (kafka/translator/audit)
  down        Stop minikube
  reset       Delete manifests and delete minikube cluster
EOF
}

minikube_ip() {
  minikube ip
}

cmd_up() {
  npm --prefix "$ROOT_DIR/ui" run build
  docker build -t dms-web:minikube "$ROOT_DIR/ui"

  minikube start \
    --driver=docker \
    --container-runtime=containerd \
    --kubernetes-version=v1.33.4 \
    --cpus=4 \
    --memory=8192
  kubectl config use-context minikube
  kubectl get nodes

  minikube image load "${IMAGES[@]}"
  kubectl apply -f "$K8S_DIR"

  local ip
  ip="$(minikube_ip)"
  echo
  echo "Presentation panels"
  echo "  Minikube IP:       $ip"
  echo "  Web UI URL:        http://$ip:30080/login"
  echo "  MinIO Console URL: http://$ip:9001 (if exposed)"
  echo "  Kafka broker:      kafka.default.svc.cluster.local:9092"
  echo "  Observability:     ./scripts/presentation_runbook.sh panels"

  echo
  echo "Watching rollout. Press Ctrl+C when all critical deployments are READY 1/1."
  kubectl get deploy,pods -n default -w
}

cmd_status() {
  kubectl get deploy,pods -n default
}

cmd_access() {
  local ip
  ip="$(minikube_ip)"
  echo "WSL panel access (recommended):"
  echo "  Terminal 1: kubectl port-forward -n default svc/web 8081:80"
  echo "  Terminal 2: kubectl port-forward -n default svc/minio 9001:9001"
  echo "  Terminal 3: kubectl port-forward -n default svc/kafka 9092:9092"
  echo "  Web UI URL:         http://localhost:8081"
  echo "  Web Login URL:      http://localhost:8081/login"
  echo "  MinIO Console URL:  http://localhost:9001"
  echo "  Kafka local broker: localhost:9092"
  echo
  echo "Observability panels (if deployed):"
  echo "  Terminal 4: kubectl port-forward -n observability svc/lab6-logs-grafana 3000:80"
  echo "  Terminal 5: kubectl port-forward -n observability svc/jaeger-ui 16686:16686"
  echo "  Grafana URL: http://localhost:3000"
  echo "  Jaeger URL:  http://localhost:16686"
  echo
  echo "Minikube direct access (secondary):"
  echo "  Web UI URL: http://$ip:30080"
}

cmd_panels() {
  echo "Panel forward commands:"
  echo "  kubectl port-forward -n default svc/web 8081:80"
  echo "  kubectl port-forward -n default svc/minio 9001:9001"
  echo "  kubectl port-forward -n default svc/kafka 9092:9092"
  echo "Optional observability:"
  echo "  kubectl port-forward -n observability svc/lab6-logs-grafana 3000:80"
  echo "  kubectl port-forward -n observability svc/jaeger-ui 16686:16686"
}

cmd_login_check() {
  local ip
  ip="$(minikube_ip)"
  curl -i -sS -X POST "http://$ip:30090/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}'
  echo
}

cmd_kafka_check() {
  kubectl exec -i deployment/kafka -- kafka-console-consumer \
    --bootstrap-server localhost:9092 \
    --topic dms.audit.events \
    --from-beginning \
    --timeout-ms 5000
}

cmd_logs() {
  echo "=== kafka ==="
  kubectl logs deployment/kafka --tail=100 || true
  echo
  echo "=== translator-service ==="
  kubectl logs deployment/translator-service --tail=100 || true
  echo
  echo "=== audit-service ==="
  kubectl logs deployment/audit-service --tail=100 || true
}

cmd_down() {
  minikube stop
}

cmd_reset() {
  kubectl delete -f "$K8S_DIR" || true
  minikube delete
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    up) cmd_up ;;
    status) cmd_status ;;
    access) cmd_access ;;
    panels) cmd_panels ;;
    login-check) cmd_login_check ;;
    kafka-check) cmd_kafka_check ;;
    logs) cmd_logs ;;
    down) cmd_down ;;
    reset) cmd_reset ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
