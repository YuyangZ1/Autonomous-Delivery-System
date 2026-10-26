package com.laioffer.deliverymanagement.auth;

import com.laioffer.deliverymanagement.api.ApiException;
import com.laioffer.deliverymanagement.dto.AppUserDto;
import com.laioffer.deliverymanagement.dto.OtpChallengeDto;
import com.laioffer.deliverymanagement.service.AppUserService;
import com.laioffer.deliverymanagement.service.OtpChallengeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;

@Service
public class AuthService {

    private final AppUserService appUserService;
    private final OtpChallengeService otpChallengeService;
    private final PasswordHashService passwordHashService;
    private final JwtService jwtService;

    public AuthService(
            AppUserService appUserService,
            OtpChallengeService otpChallengeService,
            PasswordHashService passwordHashService,
            JwtService jwtService
    ) {
        this.appUserService = appUserService;
        this.otpChallengeService = otpChallengeService;
        this.passwordHashService = passwordHashService;
        this.jwtService = jwtService;
    }

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int MAX_OTP_ATTEMPTS = 5;

    @Transactional
    public InitiateRegistrationResponse initiateRegistration(RegisterRequest request) {
        if (request.email() == null && request.phone() == null) {
            throw new ApiException(400, "EMAIL_OR_PHONE_REQUIRED", "At least one of email or phone must be provided.");
        }
        if (request.email() != null) {
            appUserService.findByEmail(request.email())
                    .filter(u -> !u.guest())
                    .ifPresent(u -> { throw new ApiException(409, "EMAIL_TAKEN", "Email is already registered."); });
        }
        if (request.phone() != null) {
            appUserService.findByPhone(request.phone())
                    .filter(u -> !u.guest())
                    .ifPresent(u -> { throw new ApiException(409, "PHONE_TAKEN", "Phone is already registered."); });
        }

        String otpCode = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        String passwordHash = passwordHashService.hash(request.password());
        String codeHash = passwordHashService.hash(otpCode);
        String channel = request.email() != null ? "EMAIL" : "SMS";

        AppUserDto pendingUser = appUserService.createUser(
                request.email(),
                request.phone(),
                passwordHash,
                request.fullName(),
                true,
                null
        );

        OtpChallengeDto challenge = otpChallengeService.createChallenge(
                pendingUser.id(),
                channel,
                codeHash,
                OffsetDateTime.now().plusMinutes(15)
        );

        return new InitiateRegistrationResponse(
                challenge.id(),
                otpCode,
                "OTP challenge created. Use the otp_code to complete registration."
        );
    }

    @Transactional
    public RegistrationResponse completeRegistration(CompleteRegistrationRequest request) {
        OtpChallengeDto challenge = otpChallengeService.findById(request.challengeId())
                .orElseThrow(() -> new ApiException(404, "OTP_CHALLENGE_NOT_FOUND", "OTP challenge was not found."));

        if (challenge.consumed()) {
            throw new ApiException(409, "OTP_ALREADY_CONSUMED", "OTP challenge has already been used.");
        }
        if (challenge.expiresAt().isBefore(java.time.OffsetDateTime.now())) {
            throw new ApiException(401, "OTP_EXPIRED", "OTP challenge has expired.");
        }
        if (challenge.attemptCount() >= MAX_OTP_ATTEMPTS) {
            throw new ApiException(401, "OTP_LOCKED",
                    "Too many incorrect attempts. Please request a new code.");
        }
        if (!passwordHashService.matches(request.otpCode(), challenge.codeHash())) {
            otpChallengeService.incrementAttemptCount(challenge.id());
            throw new ApiException(401, "OTP_INVALID", "OTP code is invalid.");
        }
        if (challenge.userId() == null) {
            throw new ApiException(409, "PENDING_USER_MISSING", "OTP challenge is not linked to a pending user.");
        }

        AppUserDto user = appUserService.findById(challenge.userId())
                .orElseThrow(() -> new ApiException(404, "USER_NOT_FOUND", "Pending user was not found."));

        AppUserDto activatedUser = appUserService.activateUser(user.id())
                .orElseThrow(() -> new ApiException(500, "USER_ACTIVATION_FAILED", "Unable to activate user."));

        otpChallengeService.markConsumed(challenge.id());

        return new RegistrationResponse(toSummary(activatedUser), "Registration completed successfully.");
    }

    public LoginResponse login(LoginRequest request) {
        AppUserDto user = appUserService.findByEmailOrPhone(request.identifier())
                .orElseThrow(() -> new ApiException(401, "AUTH_INVALID_CREDENTIALS", "Invalid credentials."));

        if (user.passwordHash() == null || !passwordHashService.matches(request.password(), user.passwordHash())) {
            throw new ApiException(401, "AUTH_INVALID_CREDENTIALS", "Invalid credentials.");
        }

        // `guest` doubles as "registration pending OTP verification" for accounts
        // created via initiateRegistration() -- a real guest (no email/password)
        // never reaches this point since the password check above already
        // rejects it. activateUser() flips this to false once OTP is verified.
        if (user.guest()) {
            throw new ApiException(403, "ACCOUNT_NOT_VERIFIED",
                    "Please complete OTP verification before logging in.");
        }

        String token = jwtService.issueToken(user);
        return new LoginResponse(token, "Bearer", jwtService.expirationSeconds(), toSummary(user));
    }

    private AppUserSummary toSummary(AppUserDto user) {
        return new AppUserSummary(
                user.id(),
                user.email(),
                user.phone(),
                user.fullName(),
                user.guest()
        );
    }
}
