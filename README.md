# Enterprise Software Project

A document management system built for a university Enterprise Software module: Spring Boot
microservices behind a gateway, a React UI, and the infrastructure to run them.

- **Services:** auth, documents, comments, search, audit, translation (LibreTranslate), an
  ESB service and the gateway
- **Data and messaging:** PostgreSQL, Cassandra, Redis, MinIO, Kafka
- **Observability:** Prometheus, Grafana, Loki, Jaeger
- **Deployment:** Docker Compose and Kubernetes manifests, with k6 load tests

## Running it

```bash
make up     # starts the stack from infra/docker/docker-compose.yml
make seed   # loads sample data
```

## License

Public domain ([Unlicense](LICENSE)). You're welcome to fork it as a starting point for your
own project.
