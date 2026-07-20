.PHONY: app-install app-start app-check api api-test docker-up docker-down check

app-install:
	cd mobile && npm install

app-start:
	cd mobile && npm run start

app-check:
	cd mobile && npm run check

api:
	docker compose up --build inference

api-test:
	docker compose --profile test run --rm inference-test

docker-up:
	docker compose up --build

docker-down:
	docker compose down

check: app-check api-test
