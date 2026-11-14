// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.live;

import com.orbit.pricing.PriceEngine;
import com.orbit.pricing.Quote;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** HTTP front for pricing-service 4.18.2 quote(). Promo evaluation is not on this path. */
public final class PricingServer {
    private PricingServer() {}

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "4411"));
        PriceEngine engine = new PriceEngine(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.createContext("/health", exchange -> write(exchange, 200, "{\"status\":\"ok\",\"service\":\"pricing-service\"}"));
        server.createContext("/quote", exchange -> quote(engine, exchange));
        server.start();
    }

    private static void quote(PriceEngine engine, HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            write(exchange, 404, "{\"error\":\"not found\"}");
            return;
        }
        Map<String, String> query = parseQuery(exchange.getRequestURI());
        String sku = query.getOrDefault("sku", "SKU-1");
        String region = query.getOrDefault("region", "us-east");
        if (!sku.matches("[A-Za-z0-9_-]+") || !region.matches("[a-z0-9-]+")) {
            write(exchange, 400, "{\"error\":\"bad query\"}");
            return;
        }
        Quote priced = engine.quote(sku, region);
        write(exchange, 200, "{\"sku\":\"" + priced.sku + "\",\"amountMinor\":" + priced.amountMinor + ",\"region\":\"" + region + "\"}");
    }

    private static Map<String, String> parseQuery(URI uri) {
        Map<String, String> out = new HashMap<>();
        String raw = uri.getRawQuery();
        if (raw == null || raw.isEmpty()) {
            return out;
        }
        for (String part : raw.split("&")) {
            String[] pair = part.split("=", 2);
            String key = urlDecode(pair[0]);
            String value = pair.length == 2 ? urlDecode(pair[1]) : "";
            out.put(key, value);
        }
        return out;
    }

    private static String urlDecode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static void write(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("content-type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream stream = exchange.getResponseBody()) {
            stream.write(bytes);
        }
    }
}
