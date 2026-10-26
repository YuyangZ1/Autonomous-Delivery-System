package com.laioffer.deliverymanagement.service;

import com.laioffer.deliverymanagement.dto.OtpChallengeDto;
import com.laioffer.deliverymanagement.entity.OtpChallengeEntity;
import com.laioffer.deliverymanagement.repository.OtpChallengeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class OtpChallengeService {

    private final OtpChallengeRepository repository;

    public OtpChallengeService(OtpChallengeRepository repository) {
        this.repository = repository;
    }

    public List<OtpChallengeDto> findAll() {
        return repository.findAll().stream().map(OtpChallengeService::toDto).toList();
    }

    public List<OtpChallengeDto> findByUserId(UUID userId) {
        return repository.findByUserId(userId).stream().map(OtpChallengeService::toDto).toList();
    }

    public Optional<OtpChallengeDto> findById(UUID id) {
        return repository.findById(id).map(OtpChallengeService::toDto);
    }

    public Optional<OtpChallengeDto> findLatestByUserId(UUID userId) {
        return repository.findLatestByUserId(userId).map(OtpChallengeService::toDto);
    }

    public Optional<OtpChallengeDto> findLatestActiveByUserId(UUID userId) {
        return repository.findLatestActiveByUserId(userId).map(OtpChallengeService::toDto);
    }

    @Transactional
    public OtpChallengeDto createChallenge(UUID userId, String channel, String codeHash, OffsetDateTime expiresAt) {
        OtpChallengeEntity saved = repository.save(
                new OtpChallengeEntity(null, userId, channel, codeHash, expiresAt, false, (short) 0, OffsetDateTime.now())
        );
        return toDto(saved);
    }

    // REQUIRES_NEW: the caller (AuthService.completeRegistration, itself
    // @Transactional) always throws right after calling this on a failed
    // attempt. With the default propagation this increment would join that
    // same transaction and get rolled back along with everything else when
    // the exception propagates -- silently discarding the very attempt count
    // the lockout check in completeRegistration() depends on. Running it in
    // its own transaction makes it commit immediately, independent of whether
    // the caller's transaction later rolls back.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<OtpChallengeDto> incrementAttemptCount(UUID id) {
        repository.incrementAttemptCount(id);
        return repository.findById(id).map(OtpChallengeService::toDto);
    }

    @Transactional
    public boolean markConsumed(UUID id) {
        return repository.markConsumed(id) > 0;
    }

    public long count() {
        return repository.count();
    }

    private static OtpChallengeDto toDto(OtpChallengeEntity e) {
        return new OtpChallengeDto(
                e.id(),
                e.userId(),
                e.channel(),
                e.codeHash(),
                e.expiresAt(),
                e.consumed(),
                e.attemptCount(),
                e.createdAt()
        );
    }
}
