# Synthetic demo code for Nexus Intelligence. Not a real system.
FROM node:22-bookworm-slim
WORKDIR /orbit
COPY cart cart
COPY checkout checkout
COPY order-service order-service
COPY risk-feature-builder risk-feature-builder
COPY live live
ENTRYPOINT ["node", "--experimental-strip-types"]
CMD ["live/observability/server.ts"]
