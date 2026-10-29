# Synthetic demo code for Nexus Intelligence. Not a real system.

.PHONY: check check-node check-java check-rust check-c

check: check-c check-rust check-java check-node

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

check-c:
	mkdir -p build
	gcc -Wall -Werror -Wextra -c cdn-edge/native/libedgeregex.c -o build/libedgeregex.o
	gcc -Wall -Werror -Wextra cdn-edge/native/libedgeregex.c cdn-edge/native/re_test.c -o build/re_test
	./build/re_test
