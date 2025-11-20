/**
 * SearchDropdown Component
 * Dropdown for selecting search type (keyword or tags)
 */

import React from "react";
import { Dropdown, Button } from "antd";
import type { MenuProps } from "antd";
import { SearchOutlined, TagsOutlined, DownOutlined } from "@ant-design/icons";
import styles from "./SearchDropdown.module.css";

export type SearchType = "keyword" | "tags";

interface SearchDropdownProps {
  value: SearchType;
  onChange: (type: SearchType) => void;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ value, onChange }) => {
  const menuItems: MenuProps["items"] = [
    {
      key: "keyword",
      label: (
        <div className={styles.menuItem}>
          <SearchOutlined className={styles.iconKeyword} />
          <span>Keyword Search</span>
        </div>
      ),
      onClick: () => onChange("keyword"),
    },
    {
      key: "tags",
      label: (
        <div className={styles.menuItem}>
          <TagsOutlined className={styles.iconTag} />
          <span>Tag Search</span>
        </div>
      ),
      onClick: () => onChange("tags"),
    },
  ];

  const getIcon = () => {
    if (value === "keyword") {
      return <SearchOutlined className={styles.iconKeyword} />;
    }
    return <TagsOutlined className={styles.iconTag} />;
  };

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={["click"]}
      getPopupContainer={() => document.body}
      align={{ overflow: { adjustX: true, adjustY: true } }}
    >
      <Button size="small" className={styles.dropdownButton}>
        {getIcon()}
        <DownOutlined className={styles.arrow} />
      </Button>
    </Dropdown>
  );
};

export default SearchDropdown;
