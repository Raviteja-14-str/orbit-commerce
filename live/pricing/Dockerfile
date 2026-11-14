# Synthetic demo code for Nexus Intelligence. Not a real system.
FROM eclipse-temurin:21-jdk-jammy
WORKDIR /src
COPY pricing-service/src /src/pricing-service/src
COPY live/pricing/PricingServer.java /src/live/pricing/PricingServer.java
RUN mkdir -p /app/classes \
    && javac -g --release 21 -d /app/classes \
        $(find pricing-service/src live/pricing -name '*.java')
ENV JAVA_TOOL_OPTIONS="-Xmx128m"
EXPOSE 4411
CMD ["java", "-cp", "/app/classes", "com.orbit.live.PricingServer"]
