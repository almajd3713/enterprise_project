COMPOSE_FILE := infra/docker/docker-compose.yml
COMPOSE := docker compose -f $(COMPOSE_FILE)

.PHONY: up down restart ps logs build pull seed seed-reset stress stress-smoke stress-comments

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=200

build:
	$(COMPOSE) build

pull:
	$(COMPOSE) pull

seed:
	./scripts/seed/seed_dms_data.sh

seed-reset:
	docker exec -i docker-postgres-1 psql -U postgres -d documentsdb -c "TRUNCATE TABLE document RESTART IDENTITY CASCADE;"
	$(COMPOSE) restart documents
	./scripts/seed/seed_dms_data.sh

stress:
	@if ! command -v k6 >/dev/null 2>&1; then echo "k6 is required. Install k6 first."; exit 1; fi
	@TARGET=$${TARGET:-http://localhost:3333/api/documents}; \
	VUS=$${VUS:-100}; \
	DURATION=$${DURATION:-5m}; \
	echo "Running stress test on $$TARGET (vus=$$VUS duration=$$DURATION)"; \
	k6 run --env TARGET=$$TARGET --vus $$VUS --duration $$DURATION scripts/load.js

stress-smoke:
	@if ! command -v k6 >/dev/null 2>&1; then echo "k6 is required. Install k6 first."; exit 1; fi
	@TARGET=$${TARGET:-http://localhost:3333/actuator/health}; \
	echo "Running smoke load on $$TARGET"; \
	k6 run --env TARGET=$$TARGET scripts/load.js

stress-comments:
	@if ! command -v k6 >/dev/null 2>&1; then echo "k6 is required. Install k6 first."; exit 1; fi
	@TARGET=$${TARGET:-http://localhost:3333/api/comments}; \
	echo "Running comments write load on $$TARGET"; \
	k6 run --env TARGET=$$TARGET scripts/k6_comments_write.js
