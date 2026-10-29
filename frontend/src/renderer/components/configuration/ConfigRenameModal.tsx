import { Button, Center, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { ConfigForm } from 'src/renderer/types';
import { configurationNameError } from '../../utils';

interface Props {
  isOpen: boolean;
  currentName: string;
  configurationsNames: string[];
  onClose: () => void;
  handleRenameConfiguration: (newName: string) => void;
}

export function ConfigRenameModal({
  isOpen,
  currentName,
  configurationsNames,
  onClose,
  handleRenameConfiguration,
}: Props) {
  const form = useForm<ConfigForm>({
    initialValues: { name: currentName },
    validate: {
      name: (value) =>
        value === currentName
          ? null
          : configurationNameError(value, configurationsNames),
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.setValues({ name: currentName });
      form.resetDirty({ name: currentName });
    }
  }, [isOpen, currentName]);

  const handleSubmit = ({ name }: ConfigForm) => {
    if (name !== currentName) handleRenameConfiguration(name);
    onClose();
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Rename configuration"
      size="sm"
      data-testid="config-rename-modal"
      {...(window.env.E2E_TEST === 'true' && {
        transitionProps: { duration: 0 },
      })}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap={16}>
          <TextInput
            label="Name"
            {...form.getInputProps('name')}
            data-autofocus
            data-testid="config-rename-name-input"
          />
          <Center mt="md">
            <Button type="submit" data-testid="config-rename-submit-button">
              Rename
            </Button>
          </Center>
        </Stack>
      </form>
    </Modal>
  );
}
