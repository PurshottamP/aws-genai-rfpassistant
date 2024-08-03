import {
  Box,
  SpaceBetween,
  Table,
  Pagination,
  Button,
  TableProps,
  Header,
  CollectionPreferences,
  Modal,
} from "@cloudscape-design/components";
import { DateTime } from "luxon";
import { useState, useEffect, useContext, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import RouterButton from "../wrappers/router-button";
import { DownloadFileData } from "./types";
import { Session } from "../../API";
import { getSignedUrl } from "./utils";

export interface SessionsProps {
  readonly toolsOpen: boolean;
}

export default function Sessions(props: SessionsProps) {
  const appContext = useContext(AppContext);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Session[]>([]);
  const [preferences, setPreferences] = useState({ pageSize: 20 });
  const [showModalDelete, setShowModalDelete] = useState(false);
  const [deleteAllSessions, setDeleteAllSessions] = useState(false);

  const { items, collectionProps, paginationProps } = useCollection(sessions, {
    filtering: {
      empty: (
        <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <b>No sessions</b>
          </SpaceBetween>
        </Box>
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingField: "startTime",
        },
        isDescending: true,
      },
    },
    selection: {},
  });

  const getSessions = useCallback(async () => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    try {
      const result = await apiClient.sessions.getSessions("rfp");
      setSessions(result.data!.listSessions);
    } catch (e) {
      console.log(e);
      setSessions([]);
    }
  }, [appContext]);

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      setIsLoading(true);
      await getSessions();
      setIsLoading(false);
    })();
  }, [appContext, getSessions, props.toolsOpen]);

  const deleteSelectedSessions = async () => {
    setShowModalDelete(false);
    if (!appContext) return;

    setIsLoading(true);
    const apiClient = new ApiClient(appContext);
    await Promise.all(
      selectedItems.map((s) => apiClient.sessions.deleteSession(s.id, "rfp"))
    );
    await getSessions();
    setIsLoading(false);
  };

  const deleteUserSessions = async () => {
    setDeleteAllSessions(false);
    if (!appContext) return;

    setIsLoading(true);
    const apiClient = new ApiClient(appContext);
    await apiClient.sessions.deleteSessions("rfp");
    await getSessions();
    setIsLoading(false);
  };

  const handleDownload = async (id: string, s3ObjectKey: string) => {
    try {
      if (!appContext) return;

      if (!s3ObjectKey || typeof s3ObjectKey !== "string") {
        console.error("Invalid S3 key");
        return;
      }

      const parts = s3ObjectKey.split("/");
      const filekey = parts[parts.length - 1];

      const downloadFileData: DownloadFileData = {
        SessionId: id,
        S3ObjectKey: filekey,
      };

      const apiClient = new ApiClient(appContext);
      const res = await apiClient.userFeedback.downloadFile({
        downloadFileData,
      });

      if (res?.data?.downloadFile?.s3Uri) {
        // Create a link and trigger a download
        const s3Uri = res.data.downloadFile.s3Uri;
        const signedUrl = await getSignedUrl(s3Uri);
        const link = document.createElement("a");
        link.href = signedUrl;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        console.error("Failed to generate presigned URL");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <>
      <Modal
        onDismiss={() => setShowModalDelete(false)}
        visible={showModalDelete}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              {" "}
              <Button variant="link" onClick={() => setShowModalDelete(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={deleteSelectedSessions}>
                Ok
              </Button>
            </SpaceBetween>{" "}
          </Box>
        }
        header={"Delete session" + (selectedItems.length > 1 ? "s" : "")}
      >
        Do you want to delete{" "}
        {selectedItems.length == 1
          ? `session ${selectedItems[0].id}?`
          : `${selectedItems.length} sessions?`}
      </Modal>
      <Modal
        onDismiss={() => setDeleteAllSessions(false)}
        visible={deleteAllSessions}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              {" "}
              <Button
                variant="link"
                onClick={() => setDeleteAllSessions(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={deleteUserSessions}>
                Ok
              </Button>
            </SpaceBetween>{" "}
          </Box>
        }
        header={"Delete all sessions"}
      >
        {`Do you want to delete ${sessions.length} sessions?`}
      </Modal>
      <Table
        {...collectionProps}
        variant="full-page"
        items={items}
        onSelectionChange={({ detail }) => {
          console.log(detail);
          setSelectedItems(detail.selectedItems);
        }}
        selectedItems={selectedItems}
        selectionType="multi"
        trackBy="id"
        empty={
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No sessions</b>
            </SpaceBetween>
          </Box>
        }
        ariaLabels={{
          selectionGroupLabel: "Items selection",
          allItemsSelectionLabel: ({ selectedItems }) =>
            `${selectedItems.length} ${
              selectedItems.length === 1 ? "item" : "items"
            } selected`,
          // @ts-expect-error no-unused-var
          itemSelectionLabel: (e, item) => item.title!,
        }}
        pagination={<Pagination {...paginationProps} />}
        loadingText="Loading history"
        loading={isLoading}
        resizableColumns
        stickyHeader={true}
        preferences={
          <CollectionPreferences
            onConfirm={({ detail }) =>
              setPreferences({ pageSize: detail.pageSize ?? 20 })
            }
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={preferences}
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 10, label: "10" },
                { value: 20, label: "20" },
                { value: 50, label: "50" },
              ],
            }}
          />
        }
        header={
          <Header
            description="List of past sessions"
            variant="awsui-h1-sticky"
            actions={
              <SpaceBetween direction="horizontal" size="m" alignItems="center">
                <RouterButton
                  iconName="add-plus"
                  href={`/chatbot/playground/${uuidv4()}`}
                  variant="inline-link"
                >
                  New session
                </RouterButton>
                <Button
                  iconAlt="Refresh list"
                  iconName="refresh"
                  variant="inline-link"
                  onClick={() => getSessions()}
                >
                  Refresh
                </Button>
                <Button
                  disabled={selectedItems.length == 0}
                  iconAlt="Delete"
                  iconName="remove"
                  variant="inline-link"
                  onClick={() => {
                    if (selectedItems.length > 0) setShowModalDelete(true);
                  }}
                >
                  Delete
                </Button>
                <Button
                  iconAlt="Delete all sessions"
                  iconName="delete-marker"
                  variant="inline-link"
                  onClick={() => setDeleteAllSessions(true)}
                >
                  Delete all sessions
                </Button>
              </SpaceBetween>
            }
          >
            Session History
          </Header>
        }
        columnDefinitions={
          [
            {
              id: "title",
              header: "RFP Reference",
              sortingField: "title",
              width: 800,
              minWidth: 200,
              cell: (e: Session) => e.title,
              isRowHeader: true,
            },
            {
              id: "startTime",
              header: "Time",
              sortingField: "startTime",
              cell: (e: Session) =>
                DateTime.fromISO(
                  new Date(e.startTime).toISOString()
                ).toLocaleString(DateTime.DATETIME_SHORT),
              sortingComparator: (a, b) => {
                return (
                  new Date(b.startTime).getTime() -
                  new Date(a.startTime).getTime()
                );
              },
            },
            {
              id: "Download",
              header: "Download Responses",
              cell: (e: Session) => (
                <Button onClick={() => handleDownload(e.id!, e.s3ObjectKey!)}>
                  Download
                </Button>
              ),
            },
          ] as TableProps.ColumnDefinition<Session>[]
        }
      />
    </>
  );
}
