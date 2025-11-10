/**
 * Memory Dashboard Component
 * Displays user's memory profile, stats, and management controls
 */

import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Modal,
  message,
  Tabs,
  Timeline,
  Tag,
  Space,
  Typography,
  Spin,
  Empty,
  Popconfirm,
} from "antd";
import {
  BankOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CalendarOutlined,
  HeartOutlined,
  DislikeOutlined,
  StarOutlined,
} from "@ant-design/icons";
import {
  getMemoryProfile,
  getMemoryStats,
  getMemoryEvents,
  clearMemory,
  type UserMemoryProfile,
  type MemoryStats,
  type MemoryEvent,
} from "../services/memory.service";
import styles from "./MemoryDashboard.module.css";

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface MemoryDashboardProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * MemoryDashboard Component
 * Full-featured memory management interface
 */
export const MemoryDashboard: React.FC<MemoryDashboardProps> = ({
  visible,
  onClose,
}) => {
  const [profile, setProfile] = useState<UserMemoryProfile | null>(null);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);

  const loadMemoryData = async () => {
    try {
      setLoading(true);

      const [profileRes, statsRes, eventsRes] = await Promise.all([
        getMemoryProfile(),
        getMemoryStats(),
        getMemoryEvents({ limit: 20 }),
      ]);

      if (profileRes.success && profileRes.data) {
        setProfile(profileRes.data);
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }

      if (eventsRes.success && eventsRes.data) {
        setEvents(eventsRes.data.events || []);
      }
    } catch (error) {
      message.error("Failed to load memory data");
      console.error("Memory load error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadMemoryData();
    }
  }, [visible]);

  const handleClearMemory = async () => {
    try {
      setClearingMemory(true);
      const response = await clearMemory();

      if (response.success) {
        message.success("Memory cleared successfully");
        loadMemoryData(); // Reload data
      } else {
        message.error("Failed to clear memory");
      }
    } catch (error) {
      message.error("Failed to clear memory");
      console.error("Clear memory error:", error);
    } finally {
      setClearingMemory(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "preference_learned":
        return <HeartOutlined style={{ color: "#52c41a" }} />;
      case "preference_updated":
        return <StarOutlined style={{ color: "#1890ff" }} />;
      case "preference_removed":
        return <DislikeOutlined style={{ color: "#ff4d4f" }} />;
      default:
        return <CalendarOutlined />;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <BankOutlined />
          <span>Memory Dashboard</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Popconfirm
          key="clear"
          title="Clear all memory?"
          description="This will permanently delete all learned information. Are you sure?"
          onConfirm={handleClearMemory}
          okText="Yes"
          cancelText="No"
          okButtonProps={{ danger: true }}
        >
          <Button danger icon={<DeleteOutlined />} loading={clearingMemory}>
            Clear All Memory
          </Button>
        </Popconfirm>,
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          onClick={loadMemoryData}
          loading={loading}
        >
          Refresh
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      {loading ? (
        <div className={styles.loadingContainer}>
          <Spin size="large" />
        </div>
      ) : (
        <Tabs defaultActiveKey="profile">
          {/* Profile Tab */}
          <TabPane tab="Profile" key="profile">
            {profile ? (
              <div className={styles.profileTab}>
                {/* Stats Overview */}
                <Row gutter={16} className={styles.statsRow}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="Total Facts"
                        value={stats?.totalFacts || 0}
                        prefix={<BankOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="Conversations"
                        value={stats?.totalConversations || 0}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="Messages"
                        value={stats?.totalMessages || 0}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="Last Updated"
                        value={
                          stats?.lastUpdated
                            ? new Date(stats.lastUpdated).toLocaleDateString()
                            : "N/A"
                        }
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Facts by Category */}
                <Card
                  title="What I Remember About You"
                  className={styles.factsCard}
                >
                  {Object.entries(profile.factsByCategory || {}).map(
                    ([category, facts]) => (
                      <div key={category} className={styles.categorySection}>
                        <Title level={5}>{category}</Title>
                        <Space wrap>
                          {(facts as string[]).map((fact, idx) => (
                            <Tag key={idx} color="blue">
                              {fact}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    )
                  )}

                  {Object.keys(profile.factsByCategory || {}).length === 0 && (
                    <Empty description="No facts learned yet. Start chatting to help me learn about you!" />
                  )}
                </Card>

                {/* Recent Topics */}
                {profile.recentTopics && profile.recentTopics.length > 0 && (
                  <Card title="Recent Topics" className={styles.topicsCard}>
                    <Space wrap>
                      {profile.recentTopics.map(
                        (topic: string, idx: number) => (
                          <Tag key={idx} color="green">
                            {topic}
                          </Tag>
                        )
                      )}
                    </Space>
                  </Card>
                )}

                {/* Preferences */}
                {profile.preferences &&
                  Object.keys(profile.preferences).length > 0 && (
                    <Card
                      title="Your Preferences"
                      className={styles.preferencesCard}
                    >
                      {Object.entries(profile.preferences).map(
                        ([key, value]) => (
                          <Paragraph key={key}>
                            <Text strong>{key}:</Text> {String(value)}
                          </Paragraph>
                        )
                      )}
                    </Card>
                  )}
              </div>
            ) : (
              <Empty description="No memory profile available" />
            )}
          </TabPane>

          {/* Timeline Tab */}
          <TabPane tab="Timeline" key="timeline">
            {events.length > 0 ? (
              <Timeline className={styles.timeline}>
                {events.map((event) => (
                  <Timeline.Item
                    key={event.id}
                    dot={getEventIcon(event.eventType)}
                  >
                    <div className={styles.timelineItem}>
                      <Text strong>{event.eventType.replace(/_/g, " ")}</Text>
                      <Text type="secondary" className={styles.timelineDate}>
                        {new Date(event.timestamp).toLocaleString()}
                      </Text>
                      <Paragraph>{event.description}</Paragraph>
                      {event.relatedFacts && event.relatedFacts.length > 0 && (
                        <Space wrap>
                          {event.relatedFacts.map(
                            (fact: string, idx: number) => (
                              <Tag key={idx} color="blue">
                                {fact}
                              </Tag>
                            )
                          )}
                        </Space>
                      )}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <Empty description="No memory events yet" />
            )}
          </TabPane>

          {/* Statistics Tab */}
          <TabPane tab="Statistics" key="statistics">
            {stats ? (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card>
                    <Statistic
                      title="Total Facts Learned"
                      value={stats.totalFacts}
                      prefix={<BankOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card>
                    <Statistic
                      title="Total Conversations"
                      value={stats.totalConversations}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card>
                    <Statistic
                      title="Total Messages"
                      value={stats.totalMessages}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card>
                    <Statistic
                      title="Memory Since"
                      value={
                        stats.lastUpdated
                          ? new Date(stats.lastUpdated).toLocaleDateString()
                          : "N/A"
                      }
                    />
                  </Card>
                </Col>
                {stats.factsByCategory && (
                  <Col span={24}>
                    <Card title="Facts by Category">
                      <Row gutter={[16, 16]}>
                        {Object.entries(stats.factsByCategory).map(
                          ([category, count]) => (
                            <Col span={8} key={category}>
                              <Statistic
                                title={category}
                                value={Number(count)}
                              />
                            </Col>
                          )
                        )}
                      </Row>
                    </Card>
                  </Col>
                )}
              </Row>
            ) : (
              <Empty description="No statistics available" />
            )}
          </TabPane>
        </Tabs>
      )}
    </Modal>
  );
};

export default MemoryDashboard;
