package com.laioffer.deliverymanagement.service;

import com.laioffer.deliverymanagement.dto.FleetVehicleDto;
import com.laioffer.deliverymanagement.entity.FleetVehicleEntity;
import com.laioffer.deliverymanagement.repository.FleetVehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class FleetVehicleService {

    private final FleetVehicleRepository repository;

    public FleetVehicleService(FleetVehicleRepository repository) {
        this.repository = repository;
    }

    public List<FleetVehicleDto> findAll() {
        return repository.findAll().stream().map(FleetVehicleService::toDto).toList();
    }

    public List<FleetVehicleDto> findByCenterId(UUID centerId) {
        return repository.findByCenterId(centerId).stream().map(FleetVehicleService::toDto).toList();
    }

    public Optional<FleetVehicleDto> findById(UUID id) {
        return repository.findById(id).map(FleetVehicleService::toDto);
    }

    private static final int MAX_CLAIM_ATTEMPTS = 50;

    // Atomically finds and reserves one available vehicle of the given type at the
    // given center. A plain "find one, then mark it unavailable" (two separate
    // calls) lets two concurrent payments both read the same vehicle as available
    // before either write lands, double-booking it. Each attempt here does a
    // conditional UPDATE (available = true -> false) that only one concurrent
    // caller can win; a losing attempt means someone else just took that specific
    // vehicle, so we retry against the next candidate -- the vehicle that lost
    // the race is no longer "available" to findFirst on the next loop iteration,
    // so this is guaranteed to terminate within the fleet's size for that
    // center/type, not loop forever.
    @Transactional
    public Optional<FleetVehicleDto> claimAvailableVehicle(UUID centerId, String vehicleType) {
        for (int attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
            Optional<FleetVehicleEntity> candidate =
                    repository.findFirstByCenterIdAndVehicleTypeAndAvailableTrue(centerId, vehicleType);
            if (candidate.isEmpty()) {
                return Optional.empty();
            }
            FleetVehicleEntity vehicle = candidate.get();
            if (repository.claimIfAvailable(vehicle.id()) == 1) {
                return Optional.of(toDto(new FleetVehicleEntity(
                        vehicle.id(), vehicle.centerId(), vehicle.vehicleType(), false,
                        vehicle.externalDeviceId(), vehicle.telemetryHint(), vehicle.metadata()
                )));
            }
            // Someone else claimed this exact vehicle between the read and the
            // conditional update above -- try the next available candidate.
        }
        return Optional.empty();
    }

    @Transactional
    public void markAvailable(UUID vehicleId) {
        setAvailable(vehicleId, true);
    }

    private void setAvailable(UUID vehicleId, boolean available) {
        FleetVehicleEntity vehicle = repository.findById(vehicleId)
                .orElseThrow(() -> new RuntimeException("Vehicle not found: " + vehicleId));
        repository.save(new FleetVehicleEntity(
                vehicle.id(),
                vehicle.centerId(),
                vehicle.vehicleType(),
                available,
                vehicle.externalDeviceId(),
                vehicle.telemetryHint(),
                vehicle.metadata()
        ));
    }

    public long count() {
        return repository.count();
    }

    private static FleetVehicleDto toDto(FleetVehicleEntity e) {
        return new FleetVehicleDto(
                e.id(),
                e.centerId(),
                e.vehicleType(),
                e.available(),
                e.externalDeviceId(),
                e.telemetryHint() == null ? null : e.telemetryHint().value(),
                e.metadata() == null ? null : e.metadata().value()
        );
    }
}
