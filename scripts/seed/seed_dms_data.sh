#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3333}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
USERS_COUNT="${USERS_COUNT:-16}"
DOCS_COUNT="${DOCS_COUNT:-120}"
COMMENTS_PER_DOC="${COMMENTS_PER_DOC:-3}"
SEED_TAG="${SEED_TAG:-seed-$(date +%Y%m%d-%H%M%S)}"

TMP_DIR="/tmp/dms-seed-${SEED_TAG}"
mkdir -p "$TMP_DIR"

log() {
  printf '[seed] %s\n' "$*"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

extract_json_value() {
  local key="$1"
  local body="$2"
  printf '%s' "$body" | sed -n "s/.*\"${key}\":\"\{0,1\}\([^,\"}]*\)\"\{0,1\}.*/\1/p" | head -n1
}

extract_doc_id() {
  local body="$1"
  printf '%s' "$body" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p' | head -n1
}

api_post_json() {
  local path="$1"
  local token="$2"
  local payload="$3"
  if [[ -n "$token" ]]; then
    curl -sS -X POST "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${token}" \
      -d "$payload"
  else
    curl -sS -X POST "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -d "$payload"
  fi
}

api_get() {
  local path="$1"
  local token="$2"
  if [[ -n "$token" ]]; then
    curl -sS "${BASE_URL}${path}" -H "Authorization: Bearer ${token}"
  else
    curl -sS "${BASE_URL}${path}"
  fi
}

login() {
  local username="$1"
  local password="$2"
  local res
  res=$(api_post_json "/api/auth/login" "" "{\"username\":\"$(json_escape "$username")\",\"password\":\"$(json_escape "$password")\"}")
  local token
  token=$(extract_json_value "token" "$res")
  if [[ -z "$token" ]]; then
    printf 'LOGIN_FAILED:%s\nResponse:%s\n' "$username" "$res" >&2
    return 1
  fi
  printf '%s' "$token"
}

declare -A TOKENS

token_for() {
  local username="$1"
  local password="$2"
  if [[ -z "${TOKENS[$username]:-}" ]]; then
    TOKENS[$username]="$(login "$username" "$password")"
  fi
  printf '%s' "${TOKENS[$username]}"
}

try_login() {
  local username="$1"
  local password="$2"
  if token="$(login "$username" "$password" 2>/dev/null)"; then
    TOKENS[$username]="$token"
    return 0
  fi
  return 1
}

create_department() {
  local token="$1"
  local name="$2"
  api_post_json "/api/departments" "$token" "{\"name\":\"$(json_escape "$name")\"}" >/dev/null || true
}

create_category() {
  local token="$1"
  local name="$2"
  api_post_json "/api/documents/categories" "$token" "{\"name\":\"$(json_escape "$name")\"}" >/dev/null || true
}

create_user() {
  local token="$1"
  local username="$2"
  local email="$3"
  local password="$4"
  local role="$5"
  local payload
  payload="{\"username\":\"$(json_escape "$username")\",\"email\":\"$(json_escape "$email")\",\"password\":\"$(json_escape "$password")\",\"roles\":[\"$(json_escape "$role")\"]}"
  api_post_json "/api/users" "$token" "$payload" >/dev/null || true
}

upload_document() {
  local token="$1"
  local title="$2"
  local filepath="$3"
  curl -sS -X POST "${BASE_URL}/api/documents/upload" \
    -H "Authorization: Bearer ${token}" \
    -F "title=${title}" \
    -F "file=@${filepath};type=text/plain"
}

add_comment() {
  local token="$1"
  local doc_id="$2"
  local content="$3"
  api_post_json "/api/comments/add" "$token" "{\"docId\":\"${doc_id}\",\"content\":\"$(json_escape "$content")\"}" >/dev/null || true
}

wait_for_gateway() {
  log "Waiting for gateway health..."
  for _ in $(seq 1 40); do
    if curl -fsS "${BASE_URL}/actuator/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Gateway is not reachable at ${BASE_URL}" >&2
  return 1
}

seed() {
  wait_for_gateway

  log "Authenticating admin"
  local admin_token
  admin_token="$(token_for "$ADMIN_USERNAME" "$ADMIN_PASSWORD")"

  log "Creating departments"
  for name in "Operations" "HR" "Legal" "Sales" "Engineering" "Support" "Compliance"; do
    create_department "$admin_token" "$name"
  done

  log "Creating categories"
  for name in "Policy" "Invoice" "Contract" "Incident" "Architecture" "Runbook" "Tender" "Report"; do
    create_category "$admin_token" "$name"
  done

  log "Creating users (${USERS_COUNT})"
  local roles=("USER" "ANALYST" "OPERATOR")
  local -a users=()
  local -a passwords=()

  if try_login "admin" "admin123"; then users+=("admin"); passwords+=("admin123"); fi
  if try_login "user" "user123"; then users+=("user"); passwords+=("user123"); fi
  if try_login "operator" "operator123"; then users+=("operator"); passwords+=("operator123"); fi
  if try_login "analyst" "analyst123"; then users+=("analyst"); passwords+=("analyst123"); fi

  for i in $(seq 1 "$USERS_COUNT"); do
    local uname="staff$(printf '%03d' "$i")"
    local role="${roles[$(( (i-1) % ${#roles[@]} ))]}"
    local pass="Pass!$(printf '%04d' "$i")aa"
    local email="${uname}@ensia.dz"
    create_user "$admin_token" "$uname" "$email" "$pass" "$role"
    if try_login "$uname" "$pass"; then
      users+=("$uname")
      passwords+=("$pass")
    fi
  done

  if [[ ${#users[@]} -eq 0 ]]; then
    echo "No usable users were available for document generation." >&2
    return 1
  fi

  log "Generating documents (${DOCS_COUNT}) and comments (${COMMENTS_PER_DOC}/doc)"
  local -a domains=("Budget" "Procurement" "Compliance" "Security" "Research" "Projects" "Operations" "Governance")
  local -a verbs=("Review" "Update" "Approval" "Assessment" "Summary" "Checklist" "Analysis" "Memo")
  local created=0

  for i in $(seq 1 "$DOCS_COUNT"); do
    local idx=$(( (i-1) % ${#users[@]} ))
    local actor="${users[$idx]}"
    local actor_pass="${passwords[$idx]}"
    local actor_token
    actor_token="$(token_for "$actor" "$actor_pass")"

    local d="${domains[$(( (i-1) % ${#domains[@]} ))]}"
    local v="${verbs[$(( (i-1) % ${#verbs[@]} ))]}"
    local title="${d} ${v} ${i}"

    local file="${TMP_DIR}/doc_${i}.txt"
    cat > "$file" <<DOC
Document: ${title}
Seed Tag: ${SEED_TAG}
Owner: ${actor}
Generated At: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
This is synthetic enterprise content for demo realism.
DOC

    local upload_res
    upload_res="$(upload_document "$actor_token" "$title" "$file")"
    local doc_id
    doc_id="$(extract_doc_id "$upload_res")"

    if [[ -z "$doc_id" ]]; then
      echo "UPLOAD_FAILED for ${title}: ${upload_res}" >&2
      continue
    fi

    created=$((created + 1))

    for c in $(seq 1 "$COMMENTS_PER_DOC"); do
      local commenter_idx=$(( (i + c) % ${#users[@]} ))
      local commenter="${users[$commenter_idx]}"
      local commenter_pass="${passwords[$commenter_idx]}"
      local commenter_token
      commenter_token="$(token_for "$commenter" "$commenter_pass")"
      local comment="${commenter} noted action item #${c} on ${title}"
      add_comment "$commenter_token" "$doc_id" "$comment"
    done

    if (( i % 20 == 0 )); then
      log "Progress: ${i}/${DOCS_COUNT} docs"
    fi
  done

  log "Triggering read/search/audit activity"
  api_get "/api/documents/list" "$admin_token" >/dev/null || true
  api_get "/api/search/documents?q=Review" "$admin_token" >/dev/null || true
  api_get "/api/search/documents?q=Compliance" "$admin_token" >/dev/null || true
  api_get "/api/audit/events" "$admin_token" >/dev/null || true

  log "Done. Created ${created}/${DOCS_COUNT} documents."
  log "Artifacts in ${TMP_DIR}"
}

seed
