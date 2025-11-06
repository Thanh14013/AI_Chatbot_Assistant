import React from "react";
import { ConversationSearchResultItem } from "./ConversationSearchResultItem";
import { ConversationSearchResult } from "../services/searchService";
import styles from "./SearchResultsList.module.css";

interface SearchResultWithTags {
  result: ConversationSearchResult;
  tags?: string[];
}

interface SearchResultsListProps {
  results: SearchResultWithTags[];
  query: string;
  onMessageClick: (conversationId: string, messageId: string) => void;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  query,
  onMessageClick,
}) => {
  if (results.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span>No conversations found</span>
      </div>
    );
  }

  return (
    <div className={styles.searchResultsList}>
      {results.map(({ result, tags }) => (
        <ConversationSearchResultItem
          key={result.conversation_id}
          result={result}
          query={query}
          onMessageClick={onMessageClick}
          tags={tags}
        />
      ))}
    </div>
  );
};
