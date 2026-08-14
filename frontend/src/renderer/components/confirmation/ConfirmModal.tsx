import { Button, Flex, Modal, Stack } from '@mantine/core';
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => boolean | void;
  children: React.ReactNode;
}

export function ConfirmModal({ isOpen, onClose, onConfirm, children }: Props) {
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Confirmation"
      size="auto"
      centered
      data-testid="confirm-modal"
      transitionProps={{
        transition: 'fade',
      }}
      {...(window.env.E2E_TEST === 'true' && {
        transitionProps: { duration: 0 },
      })}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Stack>
          {children}
          <Flex
            mih={50}
            gap="xl"
            justify="center"
            align="center"
            direction="row"
            wrap="wrap"
          >
            <Button variant="filled" color="gray" onClick={() => onClose()}>
              Cancel
            </Button>
            <Button
              variant="filled"
              onClick={() => {
                onConfirm();
              }}
              data-testid="confirm-modal-confirm-button"
            >
              Confirm
            </Button>
          </Flex>
        </Stack>
      </form>
    </Modal>
  );
}
