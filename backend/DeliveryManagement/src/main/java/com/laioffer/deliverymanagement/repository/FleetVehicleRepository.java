package com.laioffer.deliverymanagement.repository;

import com.laioffer.deliverymanagement.entity.FleetVehicleEntity;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FleetVehicleRepository extends ListCrudRepository<FleetVehicleEntity, UUID> {

    List<FleetVehicleEntity> findByCenterId(UUID centerId);

    Optional<FleetVehicleEntity> findFirstByCenterIdAndVehicleTypeAndAvailableTrue(UUID centerId, String vehicleType);

    // Conditional update: only succeeds if the vehicle was still available at the
    // moment this runs. Two concurrent callers racing for the same vehicle will
    // never both get rowsAffected == 1 -- the DB serializes the two UPDATEs, so
    // exactly one wins. This is what makes claiming atomic instead of a separate
    // find-then-mark-unavailable pair of calls.
    @Modifying
    @Query("UPDATE fleet_vehicle SET available = false WHERE id = :id AND available = true")
    int claimIfAvailable(@Param("id") UUID id);
}
