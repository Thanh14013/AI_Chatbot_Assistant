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
} from "@ant-design/icons";
import {
  getMemoryProfile,
  getMemoryStats,
  clearMemory,
  type UserMemoryProfile,
  type MemoryStats,
} from "../services/memory.service";
import styles from "./MemoryDashboard.module.css";

const { Title, Text, Paragraph } = Typography;

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
  const [loading, setLoading] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);

  const loadMemoryData = async () => {
    try {
      setLoading(true);
      // Reset state before loading to ensure clean slate
      setProfile(null);
      setStats(null);

      const [profileRes, statsRes] = await Promise.all([
        getMemoryProfile(),
        getMemoryStats(),
      ]);

      // Always set the state, even if null
      if (profileRes.success) {
        setProfile(profileRes.data || null);
      }

      if (statsRes.success) {
        setStats(statsRes.data || null);
      }
    } catch (error: any) {
      // Reset state on error to show empty state
      setProfile(null);
      setStats(null);

      // Check if it's an authentication error
      if (error?.response?.status === 401) {
        message.error("Session expired. Please login again.");
      } else {
        message.error(
          error?.response?.data?.message || "Failed to load memory data"
        );
      }
      console.error("Memory load error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadMemoryData();
    } else {
      // Reset state when modal closes to ensure clean state on next open
      setProfile(null);
      setStats(null);
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
          getPopupContainer={(trigger) =>
            trigger.parentElement || document.body
          }
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
        <div className={styles.profileTab}>
          {profile ? (
            <>
              {/* Stats Overview */}
              <Row gutter={16} className={styles.statsRow}>
                <Col span={12}>
                  <Card>
                    <Statistic
                      title="Total Facts"
                      value={stats?.totalFacts || 0}
                      prefix={<BankOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={12}>
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
                    {profile.recentTopics.map((topic: string, idx: number) => (
                      <Tag key={idx} color="green">
                        {topic}
                      </Tag>
                    ))}
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
                    {Object.entries(profile.preferences).map(([key, value]) => {
                      // Parse value - it may be comma-separated or include the key as a prefix
                      let valueStr = String(value || "");
                      const prefix = `${key}:`;
                      // Remove any prefix (e.g., "Programming Languages: Java, ...")
                      if (valueStr.startsWith(prefix)) {
                        valueStr = valueStr.slice(prefix.length).trim();
                      }

                      // Split by common separators and trim
                      const items = valueStr.includes(",")
                        ? valueStr.split(",").map((item) => item.trim())
                        : valueStr.includes(";")
                        ? valueStr.split(";").map((item) => item.trim())
                        : [valueStr];

                      return (
                        <div key={key} className={styles.categorySection}>
                          <Title level={5}>{key}</Title>
                          <Space wrap>
                            {items.map((item, idx) => (
                              <Tag key={idx} color="cyan">
                                {item}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      );
                    })}
                  </Card>
                )}
            </>
          ) : (
            <Empty
              description={
                <div>
                  <Paragraph>No memory profile available yet</Paragraph>
                  <Text type="secondary">
                    I'll start learning about you as we chat. Have some
                    conversations with me to help build your memory profile!
                  </Text>
                </div>
              }
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default MemoryDashboard;
