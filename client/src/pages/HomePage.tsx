/**
 * Home Page Component
 * Main landing page after login
 */

import React from "react";
import { Layout, Typography, Card } from "antd";
import { NavigationHeader } from "../components";
import styles from "./HomePage.module.css";

const { Content } = Layout;
const { Title, Paragraph } = Typography;

/**
 * HomePage component
 * Displays the main dashboard after user authentication
 */
const HomePage: React.FC = () => {
  return (
    <Layout className={styles.layout}>
      {/* Navigation Header */}
      <NavigationHeader />

      {/* Main Content */}
      <Content className={styles.content}>
        <div className={styles.container}>
          <Card className={styles.welcomeCard}>
            <Title level={2}>Welcome to AI Chatbot Assistant</Title>
            <Paragraph>
              You have successfully logged in. Start chatting with our AI
              assistant to get help with your questions.
            </Paragraph>
            <Paragraph type="secondary">
              More features will be available soon!
            </Paragraph>
          </Card>
        </div>
      </Content>
    </Layout>
  );
};

export default HomePage;
