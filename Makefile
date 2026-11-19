# Synthetic demo code for Nexus Intelligence. Not a real system.

.PHONY: check check-node check-java check-rust check-c check-py

check: check-c check-rust check-java check-py check-node

check-py:
	python3 -m py_compile deploy/ansible/recap.py deploy/ansible/recap_test.py
	cd deploy/ansible && python3 recap_test.py

check-node:
	node --experimental-strip-types --test tests/*.test.ts

check-java:
	mkdir -p build/classes
	find . -path ./build -prune -o -name '*.java' -print | sort > build/java-sources.txt
	javac -g --release 21 -d build/classes @build/java-sources.txt
	java -cp build/classes com.orbit.events.PeerSyncTest
	java -cp build/classes com.orbit.pricing.PriceEngineTest
	java -cp build/classes com.orbit.pricing.RegionalCapTest

check-rust:
	cargo test --manifest-path payments-gateway/Cargo.toml --quiet

.PHONY: live live-down break-nex32 break-nex28 break-nex30 heal

COMPOSE := docker compose -f live/docker-compose.yml

live:
	$(COMPOSE) up -d --build

live-down:
	$(COMPOSE) down

break-nex32:
	curl -sf -X POST http://127.0.0.1:4400/control/faults -H 'content-type: application/json' -d '{"id":"NEX-32","active":true}'

break-nex28:
	curl -sf -X POST http://127.0.0.1:4400/control/faults -H 'content-type: application/json' -d '{"id":"NEX-28","active":true}'

break-nex30:
	curl -sf -X POST http://127.0.0.1:4400/control/faults -H 'content-type: application/json' -d '{"id":"NEX-30","active":true}'

heal:
	curl -sf -X POST http://127.0.0.1:4400/control/heal

check-c:
	mkdir -p build
	gcc -Wall -Werror -Wextra -c cdn-edge/native/libedgeregex.c -o build/libedgeregex.o
	gcc -Wall -Werror -Wextra cdn-edge/native/libedgeregex.c cdn-edge/native/re_test.c -o build/re_test
	./build/re_test
