import { App as AntApp, Button, Form, Input, Typography } from "antd";
import { CarOutlined } from "@ant-design/icons";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { login as loginApi, type LoginRequest } from "@/api/client";

type LocationState = { from?: { pathname: string } };

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { message } = AntApp.useApp();
  const from = (location.state as LocationState | null)?.from?.pathname ?? "/";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #EEF2FF 0%, #F8F9FE 60%, #FFFFFF 100%)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: 420,
          background: "#FFFFFF",
          borderRadius: 16,
          padding: "40px 40px 32px",
          boxShadow:
            "0 4px 24px rgba(79,110,247,0.10), 0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
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
            Welcome Back
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
            Log in to continue using Autonomous Delivery
          </Typography.Text>
        </div>

        <Form<LoginRequest>
          layout="vertical"
          onFinish={async (values) => {
            try {
              const response = await loginApi(values);
              login({ token: response.access_token, user: response.user });
              message.success("Logged in successfully");
              navigate(from, { replace: true });
            } catch (error) {
              const err = error as Error;
              message.error(err.message || "Login failed. Please try again.");
            }
          }}
        >
          <Form.Item
            label="Email or Phone"
            name="identifier"
            rules={[{ required: true, message: "Please enter email or phone" }]}
          >
            <Input
              size="large"
              placeholder="user@example.com or +14155550101"
            />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Please enter a password" }]}
            style={{ marginBottom: 8 }}
          >
            <Input.Password size="large" placeholder="Enter your password" />
          </Form.Item>
          <Form.Item style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" block size="large">
              Log In
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: "center", marginTop: 4 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "#4F6EF7", fontWeight: 500 }}>
              Sign Up
            </Link>
          </Typography.Text>
        </div>
      </div>
    </div>
  );
}
