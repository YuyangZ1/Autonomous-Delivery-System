package com.laioffer.deliverymanagement.controller;

import com.laioffer.deliverymanagement.api.ApiException;
import com.laioffer.deliverymanagement.auth.AuthenticatedUser;
import com.laioffer.deliverymanagement.dto.DeliveryCenterDto;
import com.laioffer.deliverymanagement.dto.FleetVehicleDto;
import com.laioffer.deliverymanagement.dto.OrderDto;
import com.laioffer.deliverymanagement.dto.OrderParcelDto;
import com.laioffer.deliverymanagement.service.*;
import com.laioffer.deliverymanagement.validation.AddressValidateRequest;
import com.laioffer.deliverymanagement.validation.AddressValidationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Random;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;
    private final OrderParcelService orderParcelService;
    private final DeliveryCenterService deliveryCenterService;
    private final FleetVehicleService fleetVehicleService;
    private final PaymentService paymentService;
    private final AddressValidationService addressValidationService;
    private final Random random = new Random();

    public OrderController(
            OrderService orderService,
            OrderParcelService orderParcelService,
            DeliveryCenterService deliveryCenterService,
            FleetVehicleService fleetVehicleService,
            PaymentService paymentService,
            AddressValidationService addressValidationService
    ) {
        this.orderService = orderService;
        this.orderParcelService = orderParcelService;
        this.deliveryCenterService = deliveryCenterService;
        this.fleetVehicleService = fleetVehicleService;
        this.paymentService = paymentService;
        this.addressValidationService = addressValidationService;
    }

    @GetMapping("/me")
    public List<OrderSummaryResponse> getMyOrders(
            @AuthenticationPrincipal AuthenticatedUser user) {
        if (user == null) {
            throw new ApiException(401, "TOKEN_MISSING",
                    "Authorization header with Bearer token is required.");
        }
        return orderService.findByUserId(user.id())
                .stream()
                .map(order -> new OrderSummaryResponse(
                        order.id(),
                        order.status(),
                        order.dropoffSummary(),
                        order.vehicleTypeChosen(),
                        order.totalAmount() != null ? order.totalAmount() : BigDecimal.ZERO,
                        order.currency() != null ? order.currency() : "USD",
                        order.createdAt()
                ))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CreateOrderResponse createOrder(@Valid @RequestBody CreateOrderRequest request) {
        AuthenticatedUser user = requireAuthenticatedUser();
        if (deliveryCenterService.findById(request.centerId()).isEmpty()) {
            throw new ApiException(404, "CENTER_NOT_FOUND", "Delivery center not found.");
        }

        // Validate dropoff address is within the SF service area
        var dropoffValidation = addressValidationService.validate(new AddressValidateRequest(
                request.dropoffAddress(),
                request.dropoffLat() != null ? request.dropoffLat().doubleValue() : null,
                request.dropoffLng() != null ? request.dropoffLng().doubleValue() : null
        ));
        if (!dropoffValidation.valid()) {
            throw new ApiException(422, "ADDRESS_OUT_OF_SERVICE_AREA",
                    "Dropoff address is outside our San Francisco service area.");
        }

        OrderDto order = orderService.createOrder(
                user.id(),
                request.centerId(),
                request.pickupAddress(),
                request.pickupLat(),
                request.pickupLng(),
                request.dropoffAddress(),
                request.dropoffLat(),
                request.dropoffLng()
        );
        return new CreateOrderResponse(order.id(), order.status(), order.createdAt());
    }

    @PostMapping("/{orderId}/parcels")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateParcelResponse addParcel(
            @PathVariable UUID orderId,
            @Valid @RequestBody CreateParcelRequest request
    ) {
        AuthenticatedUser user = requireAuthenticatedUser();
        OrderDto order = orderService.findById(orderId)
                .orElseThrow(() -> new ApiException(404, "ORDER_NOT_FOUND", "Order not found."));

        if (!user.id().equals(order.userId())) {
            throw new ApiException(403, "ORDER_FORBIDDEN", "Order does not belong to the authenticated user.");
        }

        OrderParcelDto parcel = orderParcelService.createParcel(
                orderId,
                request.sizeTier(),
                request.weightKg(),
                Boolean.TRUE.equals(request.fragile()),
                request.deliveryNotes()
        );
        return new CreateParcelResponse(parcel.id(), parcel.orderId(), parcel.sizeTier(), parcel.weightKg());
    }

    @PostMapping("/{orderId}/pay")
    public PayOrderResponse payOrder(
            @PathVariable UUID orderId,
            @Valid @RequestBody PayOrderRequest request
    ) {
        AuthenticatedUser user = requireAuthenticatedUser();

        OrderDto order = orderService.findById(orderId)
                .orElseThrow(() -> new ApiException(404, "ORDER_NOT_FOUND", "Order not found."));

        if (!user.id().equals(order.userId())) {
            throw new ApiException(403, "ORDER_FORBIDDEN", "Order does not belong to the authenticated user.");
        }

        if ("IN_TRANSIT".equals(order.status()) || "DELIVERED".equals(order.status())) {
            throw new ApiException(409, "ORDER_ALREADY_PAID", "Order has already been paid.");
        }

        if (!"PENDING".equals(order.status())) {
            throw new ApiException(409, "ORDER_INVALID_STATE", "Order cannot be paid in its current state.");
        }

        DeliveryCenterDto center = deliveryCenterService.findById(order.centerId())
                .orElseThrow(() -> new ApiException(404, "CENTER_NOT_FOUND", "Delivery center not found."));
        FleetVehicleDto vehicle = fleetVehicleService
                .findAvailableByCenterAndType(order.centerId(), request.vehicleType())
                .orElseThrow(() -> new ApiException(409, "NO_VEHICLE_AVAILABLE",
                        "No available " + request.vehicleType() + " vehicle at the assigned center."));

        String handoffPin = String.format("%06d", random.nextInt(1_000_000));

        orderService.processPayment(
                orderId, vehicle.id(), request.vehicleType(),
                handoffPin, request.etaMinutes(), request.priceUsd(),
                center.latitude(), center.longitude()
        );
        fleetVehicleService.markUnavailable(vehicle.id());
        paymentService.createPayment(orderId, request.priceUsd());

        return new PayOrderResponse(
                orderId, handoffPin, request.vehicleType(),
                request.etaMinutes(), request.priceUsd(), "USD"
        );
    }

    private AuthenticatedUser requireAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
            throw new ApiException(401, "TOKEN_MISSING", "Authorization header with Bearer token is required.");
        }
        return user;
    }
}
