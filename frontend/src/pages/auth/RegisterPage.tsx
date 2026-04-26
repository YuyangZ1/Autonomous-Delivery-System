import { App as AntApp, Button, Form, Input, Steps, Typography } from "antd";
import { CarOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { register, sendOtp } from "../../api/client";

type StepOneValues = {
  name: string;
  identifier: string;
  password: string;
};

type StepTwoValues = {
  otp: string;
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepOneData, setStepOneData] = useState<StepOneValues | null>(null);
  const { message, notification } = AntApp.useApp();

  const handleSendOtp = async (values: StepOneValues) => {
    try {
      setLoading(true);

      const res = await sendOtp({
        full_name: values.name,
        email: values.identifier,
        password: values.password,
      });

      if (!res?.challenge_id) {
        throw new Error("sendOtp API did not return challenge_id. Please check if the backend has restarted.");
      }

      setChallengeId(String(res.challenge_id));
      setStepOneData(values);
      setStep(1);

      notification.open({
        type: "warning",
        message: "Development Mode — OTP Code",
        description: (
          <span>
            Your OTP code is:
            <strong
              style={{
                fontSize: 22,
                letterSpacing: 6,
                display: "inline-block",
                margin: "4px 0",
              }}
            >
              {res.otp_code}
            </strong>
            <br />
            <span style={{ color: "#888", fontSize: 12 }}>
              (This notification only appears during development. In production, it will be sent to your email or phone.)
            </span>
          </span>
        ),
        placement: "top",
        duration: 30,
      });

      message.success("OTP code has been generated. Check the notification at the top of the page.");
    } catch (error) {
      if (error instanceof Error) {
        const apiError = error as Error & { code?: string };
        if (apiError.code === "EMAIL_TAKEN") {
          message.error("This email is already registered. Please log in or use a different email.");
        } else if (apiError.code === "PHONE_TAKEN") {
          message.error("This phone number is already registered. Please log in or use a different phone.");
        } else {
          message.error(error.message || "Failed to send OTP code");
        }
      } else {
        message.error("Failed to send OTP code");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegister = async (values: StepTwoValues) => {
    if (!stepOneData || !challengeId) {
      message.error("Missing registration information. Please send the OTP code again.");
      setStep(0);
      return;
    }

    try {
      setLoading(true);
      await register({ challenge_id: challengeId, otp_code: values.otp });
      message.success("Sign up successful. Please log in.");
      navigate("/login");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #EEF2FF 0%, #F8F9FE 60%, #FFFFFF 100%)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: 460,
          background: "#FFFFFF",
          borderRadius: 16,
          padding: "40px 40px 32px",
          boxShadow:
            "0 4px 24px rgba(79,110,247,0.10), 0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 54,
              height: 54,
              background: "#EEF2FF",
              borderRadius: 14,
              marginBottom: 16,
            }}
          >
            <CarOutlined style={{ fontSize: 28, color: "#4F6EF7" }} />
          </div>
          <Typography.Title
            level={3}
            style={{ margin: 0, color: "#1A1D2E", letterSpacing: -0.5 }}
          >
            Create Account
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
            Two simple steps to get started with Autonomous Delivery
          </Typography.Text>
        </div>

        <Steps
          size="small"
          current={step}
          items={[{ title: "Basic Information" }, { title: "OTP Verification" }]}
          style={{ marginBottom: 28 }}
        />

        {step === 0 ? (
          <Form layout="vertical" onFinish={handleSendOtp}>
            <Form.Item
              label="Name"
              name="name"
              rules={[{ required: true, message: "Please enter your name" }]}
            >
              <Input size="large" placeholder="Enter your name" />
            </Form.Item>
            <Form.Item
              label="Email or Phone"
              name="identifier"
              rules={[{ required: true, message: "Please enter email or phone" }]}
            >
              <Input size="large" placeholder="user@example.com or +14155550101" />
            </Form.Item>
            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: "Please enter a password" }]}
            >
              <Input.Password size="large" placeholder="Set a password" />
            </Form.Item>
            <Form.Item style={{ marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
              >
                Send OTP Code
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <Form layout="vertical" onFinish={handleCompleteRegister}>
            <Form.Item
              label="OTP Code"
              name="otp"
              rules={[{ required: true, message: "Please enter OTP code" }]}
              style={{ marginBottom: 24 }}
            >
              <Input.OTP length={6} />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{ marginBottom: 8 }}
            >
              Complete Sign Up
            </Button>
            <Button type="text" onClick={() => setStep(0)} block>
              ← Back to Previous Step
            </Button>
          </Form>
        )}

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#4F6EF7", fontWeight: 500 }}>
              Log In
            </Link>
          </Typography.Text>
        </div>
      </div>
    </div>
  );
}
