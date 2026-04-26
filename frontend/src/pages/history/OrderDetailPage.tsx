import { useEffect, useState } from "react";
import { Badge, Button, Card, QRCode, Spin, Typography } from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { getMyOrders, getTracking, type OrderSummary } from "../../api/client";

const { Title, Text } = Typography;

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [pin, setPin] = useState<string>("----");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }

    const fetchAll = async () => {
      const [orders] = await Promise.allSettled([
        getMyOrders(),
        getTracking(orderId)
          .then((t) => { if (t.handoff_pin) setPin(t.handoff_pin); })
          .catch(() => {}),
      ]);

      if (orders.status === "fulfilled") {
        const found = orders.value.find((o) => o.order_id === orderId);
        if (found) setSummary(found);
      }
      setLoading(false);
    };

    void fetchAll();
  }, [orderId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const vehicleLabel = summary?.vehicle_type_chosen === "DRONE" ? "🚁 Drone" : "🤖 Ground Robot";
  const dateStr = summary
    ? new Date(summary.created_at).toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/history")}
          style={{ color: "#6B7280", padding: 0, marginBottom: 12 }}
        >
          Back to History
        </Button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Title level={2} style={{ margin: 0, color: "#1A1D2E", letterSpacing: -0.5 }}>
            Order Details
          </Title>
          <Badge
            status="success"
            text={
              <Text style={{ fontSize: 13, color: "#10B981", fontWeight: 600 }}>
                Delivered
              </Text>
            }
          />
        </div>
        <Text type="secondary" style={{ fontSize: 13, fontFamily: "monospace" }}>
          {orderId?.toUpperCase()}
        </Text>
      </div>

      {/* Order info card */}
      <Card
        style={{ marginBottom: 20, borderRadius: 14, border: "1.5px solid #E5EAFF" }}
        styles={{ body: { padding: "24px 28px" } }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.8,
            color: "#9CA3AF",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          Delivery Information
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Row label="Dropoff Address" value={summary?.dropoff_summary ?? "—"} />
          <Row label="Delivery Method" value={summary?.vehicle_type_chosen ? vehicleLabel : "—"} />
          <Row
            label="Order Amount"
            value={
              summary
                ? `${summary.currency === "USD" ? "$" : ""}${Number(summary.total_amount).toFixed(2)}`
                : "—"
            }
          />
          <Row label="Order Date" value={dateStr} />
          <Row
            label="Status"
            value={
              <span style={{ color: "#10B981", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircleOutlined /> Delivered
              </span>
            }
          />
        </div>
      </Card>

      {/* PIN card */}
      <Card
        style={{ borderRadius: 14, border: "1.5px solid #E5EAFF" }}
        styles={{ body: { padding: "24px 28px" } }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.8,
            color: "#9CA3AF",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          Pickup Credentials
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
              Pickup PIN
            </Text>
            <div
              style={{
                background: "#EEF2FF",
                borderRadius: 12,
                padding: "12px 20px",
                display: "inline-block",
                fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace',
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: 10,
                color: "#4F6EF7",
              }}
            >
              {pin}
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
              Scan to Pickup
            </Text>
            <div
              style={{
                border: "2px solid #E5EAFF",
                borderRadius: 12,
                padding: 8,
                display: "inline-block",
              }}
            >
              <QRCode value={`UNLOCK:${orderId}:${pin}`} size={100} bordered={false} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
      <Text type="secondary" style={{ fontSize: 13, flexShrink: 0 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, color: "#1A1D2E", textAlign: "right" }}>
        {value}
      </Text>
    </div>
  );
}
