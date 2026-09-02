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

    public Optional<FleetVehicleDto> findAvailableByCenterAndType(UUID centerId, String vehicleType) {
        return repository.findFirstByCenterIdAndVehicleTypeAndAvailableTrue(centerId, vehicleType)
                .map(FleetVehicleService::toDto);
    }

    @Transactional
    public void markUnavailable(UUID vehicleId) {
        setAvailable(vehicleId, false);
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
