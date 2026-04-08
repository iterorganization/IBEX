import { Button, Flex, Modal, Stack } from '@mantine/core';

interface Props {
  isOpen: boolean;
  titleModal: string;
  contentComponent: JSX.Element;
  onClose: () => void;
  handleSavePreferences: () => void;
}

export function PreferenceModal({
  isOpen,
  titleModal,
  contentComponent,
  onClose,
  handleSavePreferences,
}: Props) {
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={titleModal}
      size="auto"
      centered
      transitionProps={{
        transition: 'fade',
      }}
      {...(window.env.E2E_TEST === 'true' && {
        transitionProps: { duration: 0 },
      })}
    >
      <Stack>
        {/* Main content */}
        {contentComponent}

        <Flex
          mih={50}
          gap="xl"
          justify="center"
          align="center"
          direction="row"
          wrap="wrap"
        >
          <Button variant="outline" onClick={() => onClose()}>
            Cancel
          </Button>
          <Button
            variant="filled"
            onClick={() => {
              handleSavePreferences();
            }}
          >
            Save
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
