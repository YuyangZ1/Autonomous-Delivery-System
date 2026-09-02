package com.laioffer.deliverymanagement.tracking;

import com.laioffer.deliverymanagement.api.ApiException;
import com.laioffer.deliverymanagement.auth.AuthenticatedUser;
import com.laioffer.deliverymanagement.dto.DeliveryCenterDto;
import com.laioffer.deliverymanagement.entity.OrderEntity;
import com.laioffer.deliverymanagement.repository.OrderRepository;
import com.laioffer.deliverymanagement.service.DeliveryCenterService;
import com.laioffer.deliverymanagement.service.FleetVehicleService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
public class TrackingController {

    private final OrderRepository orderRepository;
    private final DeliveryCenterService deliveryCenterService;
    private final FleetVehicleService fleetVehicleService;

    public TrackingController(
            OrderRepository orderRepository,
            DeliveryCenterService deliveryCenterService,
            FleetVehicleService fleetVehicleService
    ) {
        this.orderRepository = orderRepository;
        this.deliveryCenterService = deliveryCenterService;
        this.fleetVehicleService = fleetVehicleService;
    }

    @GetMapping("/{orderId}/tracking")
    public TrackingResponse getTracking(@PathVariable UUID orderId) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthenticatedUser user)) {
            throw new ApiException(401, "UNAUTHORIZED", "Authorization header with Bearer token is required.");
        }

        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ApiException(404, "ORDER_NOT_FOUND", "Order not found."));

        if (!order.userId().equals(user.id())) {
            throw new ApiException(403, "FORBIDDEN", "You do not have access to this order.");
        }

        // Look up delivery center coordinates for the start marker
        BigDecimal startLat = null;
        BigDecimal startLng = null;
        if (order.centerId() != null) {
            startLat = deliveryCenterService.findById(order.centerId())
                    .map(DeliveryCenterDto::latitude).orElse(null);
            startLng = deliveryCenterService.findById(order.centerId())
                    .map(DeliveryCenterDto::longitude).orElse(null);
        }

        if ("DELIVERED".equals(order.status())) {
            BigDecimal dLat = null, dLng = null;
            try {
                var state = order.trackingState().value();
                dLat = extractDecimal(state, "dropoffLat");
                dLng = extractDecimal(state, "dropoffLng");
            } catch (Exception ignored) {}
            return new TrackingResponse(
                    order.id(),
                    "DELIVERED",
                    order.vehicleTypeChosen(),
                    order.handoffPin(),
                    order.simLatitude(),
                    order.simLongitude(),
                    order.simHeadingDeg(),
                    0,
                    startLat, startLng, dLat, dLng
            );
        }

        BigDecimal dropoffLat;
        BigDecimal dropoffLng;
        try {
            var state = order.trackingState().value();
            dropoffLat = extractDecimal(state, "dropoffLat");
            dropoffLng = extractDecimal(state, "dropoffLng");
        } catch (Exception e) {
            throw new ApiException(400, "TRACKING_NOT_READY", "Order tracking data is not yet available.");
        }

        BigDecimal simLat = order.simLatitude();
        BigDecimal simLng = order.simLongitude();

        if (simLat == null || simLng == null) {
            simLat = dropoffLat;
            simLng = dropoffLng;
        }

        double dLat = dropoffLat.doubleValue() - simLat.doubleValue();
        double dLng = dropoffLng.doubleValue() - simLng.doubleValue();
        double dist = Math.sqrt(dLat * dLat + dLng * dLng);

        String newStatus = order.status();
        BigDecimal newLat = simLat;
        BigDecimal newLng = simLng;
        BigDecimal newHeading = order.simHeadingDeg();

        if (dist < 0.002) {
            newStatus = "DELIVERED";
            newLat = dropoffLat;
            newLng = dropoffLng;
        } else {
            double step = 0.001 / dist;
            newLat = BigDecimal.valueOf(simLat.doubleValue() + dLat * step)
                    .setScale(7, RoundingMode.HALF_UP);
            newLng = BigDecimal.valueOf(simLng.doubleValue() + dLng * step)
                    .setScale(7, RoundingMode.HALF_UP);
            double headingRad = Math.atan2(dLng, dLat);
            newHeading = BigDecimal.valueOf(Math.toDegrees(headingRad))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        double remainingKm = dist * 111.0;
        double speedKmh = "DRONE".equals(order.vehicleTypeChosen()) ? 40.0 : 15.0;
        int etaMinutes = (int) Math.ceil(remainingKm / speedKmh * 60);

        OrderEntity updated = new OrderEntity(
                order.id(), order.userId(), order.centerId(), order.fleetVehicleId(),
                newStatus, order.vehicleTypeChosen(),
                order.pickupSummary(), order.dropoffSummary(),
                order.handoffPin(), etaMinutes,
                order.totalAmount(), order.currency(),
                newLat, newLng, newHeading, OffsetDateTime.now(),
                order.planSnapshot(), order.trackingState(),
                order.createdAt(), OffsetDateTime.now(),
                order.version(), order.metadata()
        );
        orderRepository.save(updated);

        if ("DELIVERED".equals(newStatus) && order.fleetVehicleId() != null) {
            fleetVehicleService.markAvailable(order.fleetVehicleId());
        }

        return new TrackingResponse(
                order.id(),
                newStatus,
                order.vehicleTypeChosen(),
                order.handoffPin(),
                newLat,
                newLng,
                newHeading,
                etaMinutes,
                startLat, startLng, dropoffLat, dropoffLng
        );
    }

    private BigDecimal extractDecimal(String json, String key) {
        String search = "\"" + key + "\":";
        int idx = json.indexOf(search);
        if (idx < 0) throw new IllegalArgumentException("Key not found: " + key);
        int start = idx + search.length();
        int end = json.indexOf(',', start);
        if (end < 0) end = json.indexOf('}', start);
        return new BigDecimal(json.substring(start, end).trim());
    }
}
