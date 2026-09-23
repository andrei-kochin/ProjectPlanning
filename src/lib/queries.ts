const PROJECT_FIELDS = /* GraphQL */ `
  fragment BoardFields on ProjectV2 {
    id
    title
    url
    fields(first: 50) {
      nodes {
        __typename
        ... on ProjectV2FieldCommon { id name dataType }
        ... on ProjectV2SingleSelectField { options { id name color } }
        ... on ProjectV2IterationField {
          configuration {
            iterations { id title startDate duration }
            completedIterations { id title startDate duration }
          }
        }
      }
    }
  }
`;

const ITEM_FIELDS = /* GraphQL */ `
  fragment ItemFields on ProjectV2Item {
    id
    type
    isArchived
    content {
      __typename
      ... on Issue {
        id
        number
        title
        url
        state
        createdAt
        closedAt
        repository { nameWithOwner }
        assignees(first: 10) { nodes { login } }
        labels(first: 20) { nodes { name color } }
        timelineItems(itemTypes: [ASSIGNED_EVENT], first: 1) {
          nodes { ... on AssignedEvent { createdAt } }
        }
      }
    }
    fieldValues(first: 30) {
      nodes {
        __typename
        ... on ProjectV2ItemFieldSingleSelectValue {
          optionId
          field { ... on ProjectV2FieldCommon { id } }
        }
        ... on ProjectV2ItemFieldDateValue {
          date
          field { ... on ProjectV2FieldCommon { id } }
        }
        ... on ProjectV2ItemFieldIterationValue {
          iterationId
          field { ... on ProjectV2FieldCommon { id } }
        }
      }
    }
  }
`;

export function boardQuery(ownerType: 'user' | 'organization'): string {
  return /* GraphQL */ `
    query Board($owner: String!, $number: Int!, $after: String) {
      owner: ${ownerType}(login: $owner) {
        projectV2(number: $number) {
          ...BoardFields
          items(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { ...ItemFields }
          }
        }
      }
    }
    ${PROJECT_FIELDS}
    ${ITEM_FIELDS}
  `;
}

export const REPO_OPEN_ISSUES_QUERY = /* GraphQL */ `
  query RepoIssues($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      issues(first: 100, after: $after, states: [OPEN]) {
        pageInfo { hasNextPage endCursor }
        nodes { id number }
      }
    }
  }
`;

export const ADD_ITEM_MUTATION = /* GraphQL */ `
  mutation AddItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item { id }
    }
  }
`;

export const UPDATE_FIELD_MUTATION = /* GraphQL */ `
  mutation UpdateField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
    updateProjectV2ItemFieldValue(
      input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }
    ) {
      projectV2Item { id }
    }
  }
`;

export const CLEAR_FIELD_MUTATION = /* GraphQL */ `
  mutation ClearField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
    clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }) {
      projectV2Item { id }
    }
  }
`;

export const VIEWER_QUERY = /* GraphQL */ `
  query Viewer { viewer { login } }
`;
