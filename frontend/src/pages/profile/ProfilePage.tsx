// F8.
//
// BEFORE (original stub — static placeholder, no real data):
//
// import { Card, Form, Input, Button, Typography } from 'antd';
//
// export function ProfilePage() {
//   return (
//     <Card title="用户资料">
//       <Typography.Paragraph type="secondary">
//         占位：UI-AUTH-05（US-1.4），P1 冲刺实现。
//       </Typography.Paragraph>
//       <Form layout="vertical" style={{ maxWidth: 400 }}>
//         <Form.Item label="姓名">
//           <Input placeholder="张三" />
//         </Form.Item>
//         <Form.Item label="手机">
//           <Input placeholder="+1..." />
//         </Form.Item>
//         <Form.Item label="邮箱">
//           <Input placeholder="user@example.com" />
//         </Form.Item>
//         <Button type="primary">保存（占位）</Button>
//       </Form>
//     </Card>
//   );
// }
//
// AFTER:
//   1. On mount → GET /auth/me → pre-fill fullName and phone from real session data.
//   2. "保存" button → PUT /api/v1/users/me → persist changes.
//   3. Success → green "个人信息已更新" alert.
//   4. Email field is always readOnly (immutable by design).

import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Spin } from "antd";
import { getMe, updateProfile, type AppUserSummary } from "../../api/client";

export function ProfilePage() {
  const [initialData, setInitialData] = useState<AppUserSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step 1: load current user identity from GET /auth/me on mount.
  useEffect(() => {
    getMe()
      .then((data) => setInitialData(data))
      .catch((err: { message?: string }) =>
        setLoadError(err?.message ?? "Failed to load user info"),
      )
      .finally(() => setLoading(false));
  }, []);

  // Step 2: submit handler calls PUT /api/v1/users/me with only fullName + phone.
  function handleSave(values: { fullName: string; phone: string }) {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    updateProfile({ full_name: values.fullName, phone: values.phone })
      .then((updated) => {
        setInitialData(updated);
        setSaveSuccess(true);
      })
      .catch((err: { message?: string }) =>
        setSaveError(err?.message ?? "Save failed"),
      )
      .finally(() => setSaving(false));
  }

  if (loading) {
    return (
      <Card title="Profile">
        <Spin tip="Loading..." />
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card title="Profile">
        <Alert type="error" message={loadError} />
      </Card>
    );
  }

  return (
    <Card title="Profile" style={{ maxWidth: 500 }}>
      {saveSuccess && (
        <Alert
          type="success"
          message="Profile information updated"
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}
      {saveError && (
        <Alert
          type="error"
          message={saveError}
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      <Form
        layout="vertical"
        initialValues={{
          fullName: initialData?.full_name ?? "",
          phone: initialData?.phone ?? "",
          email: initialData?.email ?? "",
        }}
        onFinish={handleSave}
      >
        <Form.Item label="Name" name="fullName">
          <Input placeholder="John Doe" />
        </Form.Item>

        <Form.Item label="Phone" name="phone">
          <Input placeholder="+1..." />
        </Form.Item>

        {/* Email is read-only — backend never allows email changes */}
        <Form.Item label="Email" name="email">
          <Input placeholder="user@example.com" readOnly style={{ color: "#888" }} />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={saving}>
          Save
        </Button>
      </Form>
    </Card>
  );
}
