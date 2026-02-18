import { Group, Tooltip } from '@mantine/core';
import { OptionWithTooltip } from '../../types/components/select';
import { IconCheck, IconHelpCircle } from '@tabler/icons-react';

const iconProps = {
  stroke: 1.5,
  color: 'currentColor',
  opacity: 0.6,
  size: 20,
};

interface RenderSelectOptionProps {
  option: OptionWithTooltip;
  checked: boolean;
}

export const RenderSelectOption = ({
  option,
  checked,
}: RenderSelectOptionProps) => {
  return (
    <Group justify="space-between" w="100%">
      <Group gap="xs">
        {checked && (
          <IconCheck style={{ marginInlineStart: 'auto' }} {...iconProps} />
        )}
        {option.value}
      </Group>

      <Tooltip label={option.tooltip} openDelay={300} position="bottom-end">
        {<IconHelpCircle {...iconProps} />}
      </Tooltip>
    </Group>
  );
};
