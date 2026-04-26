import {
  LogoutOutlined,
  ShoppingOutlined,
  HistoryOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  UserOutlined,
  CarOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const { Header, Content } = Layout;

const navItems = [
  { key: '/', icon: <HomeOutlined />, label: 'Home' },
  { key: '/order', icon: <ShoppingOutlined />, label: 'Create Order' },
  { key: '/recommendations', icon: <EnvironmentOutlined />, label: 'Delivery Options' },
  { key: '/history', icon: <HistoryOutlined />, label: 'Order History' },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const selectedKey = navItems.reduce((best, item) => {
    const exact = location.pathname === item.key;
    const nested = item.key !== '/' && location.pathname.startsWith(`${item.key}/`);
    if (exact || nested) {
      return item.key.length > best.length ? item.key : best;
    }
    return best;
  }, '/');

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/profile'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Log Out',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#F4F6FD' }}>
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#fff',
          borderBottom: '1px solid #E5EAFF',
          padding: '0 32px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 1px 0 0 #E5EAFF',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            minWidth: 160,
            flexShrink: 0,
          }}
          onClick={() => navigate('/')}
        >
          <div
            style={{
              width: 34,
              height: 34,
              background: '#EEF2FF',
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CarOutlined style={{ fontSize: 18, color: '#4F6EF7' }} />
          </div>
          <Typography.Text strong style={{ fontSize: 15, color: '#1A1D2E', letterSpacing: -0.3 }}>
            Autonomous Delivery
          </Typography.Text>
        </div>

        {/* Nav */}
        <Menu
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={navItems}
          onClick={({ key }) => navigate(key)}
          style={{
            flex: 1,
            borderBottom: 'none',
            justifyContent: 'center',
            background: 'transparent',
          }}
        />

        {/* User avatar dropdown */}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: 10,
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = '#F4F6FD';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            <Avatar size={30} icon={<UserOutlined />} style={{ background: '#4F6EF7' }} />
            <DownOutlined style={{ fontSize: 10, color: '#6B7280' }} />
          </div>
        </Dropdown>
      </Header>

      <Content>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}
