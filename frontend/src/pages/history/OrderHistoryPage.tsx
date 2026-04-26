import { Badge, Button, Empty, Spin, Typography } from "antd";
import {
  ArrowRightOutlined,
  HistoryOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getMyOrders} from "../../api/client";
import type { OrderSummary } from "../../api/client";

const { Title, Text } = Typography;

type OrderStatus = "PENDING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
type BadgeStatus = "processing" | "success" | "warning" | "error" | "default";

const STATUS_CONFIG = {
  IN_TRANSIT: { badgeStatus: "processing" as const, label: "In Transit",  color: "#4F6EF7" },
  DELIVERED:  { badgeStatus: "success"    as const, label: "Delivered",  color: "#52C41A" },
  PENDING:    { badgeStatus: "warning"    as const, label: "Processing",  color: "#FA8C16" },
  CANCELLED:  { badgeStatus: "error"      as const, label: "Cancelled",  color: "#FF4D4F" },
} satisfies Record<OrderStatus, { badgeStatus: BadgeStatus; label: string; color: string }>;

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyOrders()
        .then((data) => setOrders(data))
        .catch((err) => setError(err.message ?? "Failed to load"))
        .finally(() => setLoading(false));
  }, []);

  return (
      <div>
        {/* Header */}
        <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 28,
            }}
        >
          <div>
            <Title
                level={2}
                style={{ margin: "0 0 4px", color: "#1A1D2E", letterSpacing: -0.5 }}
            >
              Order History
            </Title>
            <Text type="secondary">View all delivery history</Text>
          </div>
          <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/order")}
              style={{ borderRadius: 10 }}
          >
            Create Order
          </Button>
        </div>

        {/* Loading */}
        {loading && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Spin size="large" />
            </div>
        )}

        {/* Error */}
        {!loading && error && (
            <div style={{ color: "#FF4D4F", textAlign: "center", padding: "40px 0" }}>
              {error}
            </div>
        )}

        {/* Empty */}
        {!loading && !error && orders.length === 0 && (
            <Empty
                image={
                  <HistoryOutlined style={{ fontSize: 64, color: "#C4CCDD" }} />
                }
                description={
                  <span style={{ color: "#9CA3AF" }}>No orders yet</span>
                }
                style={{ padding: "60px 0" }}
            >
              <Button type="primary" onClick={() => navigate("/order")}>
                Create First Order
              </Button>
            </Empty>
        )}

        {/* Order list */}
        {!loading && !error && orders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {orders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] ?? {
                  badgeStatus: "default" as BadgeStatus,
                  label: order.status,
                  color: "#999",
                };
                const dateStr = new Date(order.created_at).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "2-digit", day: "2-digit" }
                );
                const isDelivered = order.status === "DELIVERED";
                const isInTransit = order.status === "IN_TRANSIT";

                return (
                    <div
                        key={order.order_id}
                        style={{
                          background: "#fff",
                          border: "1.5px solid #E5EAFF",
                          borderRadius: 14,
                          padding: "18px 22px",
                          display: "flex",
                          alignItems: "center",
                          gap: 20,
                          transition: "box-shadow 0.15s, border-color 0.15s",
                          cursor: "default",
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLDivElement;
                          el.style.boxShadow = "0 4px 16px rgba(79,110,247,0.10)";
                          el.style.borderColor = "#C7D3FF";
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLDivElement;
                          el.style.boxShadow = "none";
                          el.style.borderColor = "#E5EAFF";
                        }}
                    >
                      {/* Left: ID + dropoff */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              color: "#9CA3AF",
                              marginBottom: 4,
                              fontFamily: "monospace",
                            }}
                        >
                          {order.order_id.slice(0, 8).toUpperCase()}
                        </div>
                        <div
                            style={{
                              fontSize: 13,
                              color: "#1A1D2E",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                        >
                          → {order.dropoff_summary}
                        </div>
                        {order.vehicle_type_chosen && (
                            <div style={{ fontSize: 11, color: "#C4CCDD", marginTop: 2 }}>
                              {order.vehicle_type_chosen}
                            </div>
                        )}
                      </div>

                      {/* Middle: Status + date */}
                      <div style={{ textAlign: "center", flexShrink: 0 }}>
                        <Badge
                            status={cfg.badgeStatus}
                            text={
                              <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: cfg.color,
                                  }}
                              >
                        {cfg.label}
                      </span>
                            }
                        />
                        <div style={{ fontSize: 12, color: "#C4CCDD", marginTop: 2 }}>
                          {dateStr}
                        </div>
                      </div>

                      {/* Right: Price + action */}
                      <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            flexShrink: 0,
                          }}
                      >
                        <div
                            style={{
                              fontSize: 18,
                              fontWeight: 800,
                              color: "#1A1D2E",
                              fontVariantNumeric: "tabular-nums",
                              letterSpacing: -0.5,
                            }}
                        >
                          {order.currency === "USD" ? "$" : ""}
                          {Number(order.total_amount).toFixed(2)}
                        </div>

                        {isDelivered && (
                            <Button
                                type="text"
                                icon={<ArrowRightOutlined />}
                                iconPosition="end"
                                onClick={() =>
                                    navigate(`/orders/${order.order_id}/detail`)
                                }
                                style={{
                                  color: "#52C41A",
                                  fontWeight: 600,
                                  fontSize: 13,
                                  padding: "0 8px",
                                }}
                            >
                              View Details
                            </Button>
                        )}

                        {isInTransit && (
                            <Button
                                type="text"
                                icon={<ArrowRightOutlined />}
                                iconPosition="end"
                                onClick={() =>
                                    navigate(`/orders/${order.order_id}/tracking`)
                                }
                                style={{
                                  color: "#4F6EF7",
                                  fontWeight: 600,
                                  fontSize: 13,
                                  padding: "0 8px",
                                }}
                            >
                              Track
                            </Button>
                        )}
                      </div>
                    </div>
                );
              })}
            </div>
        )}
      </div>
  );
}