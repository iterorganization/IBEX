import classes from './HoverButtons.module.css';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Group,
  Tooltip,
  ActionIcon,
  Text,
  Tabs,
  Switch,
  ScrollArea,
} from '@mantine/core';
import {
  IconBrandDatabricks,
  IconCheck,
  IconEdit,
  IconPalette,
  IconTrash,
} from '@tabler/icons-react';
import { useHover } from '@mantine/hooks';
import { Configuration, DataGridPlot } from '../../types';
import { applyRange, fetchErrorBandsInConfig } from '../../utils';
import { useIbexStore } from '../../stores';

interface HoverButtonsProps {
  data: DataGridPlot;
  shouldDisplayMetadata: boolean;
  handleEditGrid: (id: string) => void;
  handleInspectMetadata: (id: string) => void;
  handleCustomization: (id: string) => void;
  handleDeleteGrid: (id: string) => void;
  is3DView: boolean;
  setIs3DView: React.Dispatch<React.SetStateAction<boolean>>;
  active3DTab: string;
  setActive3DTab: React.Dispatch<React.SetStateAction<string>>;
}

export const HoverButtons = React.memo(
  ({
    data,
    shouldDisplayMetadata,
    handleEditGrid,
    handleInspectMetadata,
    handleCustomization,
    handleDeleteGrid,
    is3DView,
    setIs3DView,
    active3DTab,
    setActive3DTab,
  }: HoverButtonsProps) => {
    const { active, updatedConfiguration } = useIbexStore();
    const { hovered, ref: hoverRef } = useHover();
    const previousValueDisplayErrorBands = useRef<boolean | undefined>(
      undefined,
    );

    const heatmapLogo = (
      <svg width="50" height="50" viewBox="0 0 50 50">
        <rect x="0" y="0" width="15" height="15" fill="#440154" />
        <rect x="17" y="0" width="15" height="15" fill="#31688e" />
        <rect x="34" y="0" width="15" height="15" fill="#35b779" />

        <rect x="0" y="17" width="15" height="15" fill="#fde725" />
        <rect x="17" y="17" width="15" height="15" fill="#440154" />
        <rect x="34" y="17" width="15" height="15" fill="#31688e" />

        <rect x="0" y="34" width="15" height="15" fill="#35b779" />
        <rect x="17" y="34" width="15" height="15" fill="#fde725" />
        <rect x="34" y="34" width="15" height="15" fill="#440154" />
      </svg>
    );

    const updateDisplayErrorBands = useCallback(
      (newValue: boolean) => {
        const updatedActive = JSON.parse(
          JSON.stringify(active),
        ) as Configuration;
        const selectedDataPlot = updatedActive.dataPlot.find(
          (dataPlot) => dataPlot.i === data.i,
        );
        selectedDataPlot.displayErrorBand = newValue;
        updatedConfiguration(updatedActive);
      },
      [active],
    );

    const removeErrorBands = useCallback(
      (active: Configuration) => {
        const selectedDataPlot = active.dataPlot.find(
          (dataPlot) => dataPlot.i === data.i,
        );
        for (const plot of selectedDataPlot.plot) {
          active.checkedNodeURI = active.checkedNodeURI.filter(
            (checkedNode) =>
              !plot?.error_bands
                ?.map((err) => err.path)
                ?.includes(checkedNode.uri),
          );
          delete plot?.error_bands;
          delete plot?.error_y;
        }
      },
      [active],
    );

    useEffect(() => {
      const updateErrorBands = async () => {
        const updatedActive = JSON.parse(
          JSON.stringify(active),
        ) as Configuration;
        if (data.displayErrorBand) {
          if (
            previousValueDisplayErrorBands.current === false &&
            data.displayErrorBand === true
          ) {
            // Get all error bands from selected dataPlot when user active error bands
            const selectedDataPlot = updatedActive.dataPlot.find(
              (dataPlot) => dataPlot.i === data.i,
            );
            for (const plot of selectedDataPlot.plot) {
              await fetchErrorBandsInConfig(updatedActive, plot.nodeUri);
            }

            // Apply ranges to the new error bands added with switch "display error bands"
            for (const coordinate of selectedDataPlot.coordinates) {
              if (coordinate?.range) {
                const keepValueIndex = true;
                await applyRange(
                  coordinate,
                  coordinate.rangeValues,
                  selectedDataPlot,
                  [
                    ...selectedDataPlot.plot.map(
                      (plot) => plot.nodeUri + '_error_upper',
                    ),
                    ...selectedDataPlot.plot.map(
                      (plot) => plot.nodeUri + '_error_lower',
                    ),
                  ],
                  keepValueIndex,
                );
              }
            }
          }
        } else {
          // Removes all error bands from selected dataPlot
          removeErrorBands(updatedActive);
        }
        // Update previous value (used to determine the condition: previous === false && new === true)
        previousValueDisplayErrorBands.current = data.displayErrorBand;

        // Update config
        updatedConfiguration(updatedActive);
      };

      // Triggerred when update "Error bands" switch
      updateErrorBands();
    }, [data.displayErrorBand]);

    return (
      <div ref={hoverRef} className={classes.containerButton}>
        <Group justify="space-between" h={'100%'}>
          {is3DView || !data.coordinates.length || shouldDisplayMetadata ? (
            <Tabs
              value={active3DTab}
              onChange={(value) => setActive3DTab(value)}
            >
              <ScrollArea
                type="hover"
                scrollHideDelay={0} // keep visible scrollbar only during hover
                scrollbarSize={6}
                offsetScrollbars
                maw={
                  hoverRef?.current?.offsetWidth
                    ? !data.coordinates.length || shouldDisplayMetadata
                      ? hoverRef.current.offsetWidth - 110
                      : hoverRef.current.offsetWidth - 230
                    : '100%'
                }
              >
                <Tabs.List
                  style={{
                    flexWrap: 'nowrap',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {data.plot.map((plot, index) => (
                    <Tabs.Tab key={`3D_tab_${index}`} value={index.toString()}>
                      {plot.name}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </ScrollArea>
            </Tabs>
          ) : (
            <div></div>
          )}

          {hovered || data.isEditing ? (
            <Group pos="absolute" right={'1rem'} top={5}>
              {!is3DView && data.isEditing && !shouldDisplayMetadata && (
                <Switch
                  label="Error bands"
                  checked={data.displayErrorBand}
                  onChange={(event) =>
                    updateDisplayErrorBands(event.currentTarget.checked)
                  }
                />
              )}

              {data.coordinates.length >= 2 && !shouldDisplayMetadata && (
                <Tooltip label="Toggle 1D/Heatmap view">
                  <ActionIcon
                    variant="filled"
                    aria-label="Toggle 1D/Heatmap view"
                    onClick={() => setIs3DView((prev) => !prev)}
                    className={classes.actionButton}
                  >
                    {is3DView ? <Text fw="bold">1D</Text> : heatmapLogo}
                  </ActionIcon>
                </Tooltip>
              )}

              {data.coordinates.length && !shouldDisplayMetadata && (
                <Tooltip label="Inspect metadatas information">
                  <ActionIcon
                    variant="filled"
                    aria-label="Metadatas"
                    onClick={() => handleInspectMetadata(data.i)}
                    className={classes.actionButton}
                    // Disable when no names in plots (case when add template with bad URIs in first URIs selection)
                    disabled={
                      !(data.plot.filter((plot) => plot.name)?.length > 0)
                    }
                  >
                    <IconBrandDatabricks
                      style={{ width: '70%', height: '70%' }}
                      stroke={1.5}
                    />
                  </ActionIcon>
                </Tooltip>
              )}

              {data.coordinates.length && !shouldDisplayMetadata && (
                // Show customization button only if plottable
                <Tooltip label="Customize the grid">
                  <ActionIcon
                    variant="filled"
                    aria-label="Metadatas"
                    onClick={() => handleCustomization(data.i)}
                    className={classes.actionButton}
                  >
                    <IconPalette
                      style={{ width: '70%', height: '70%' }}
                      stroke={1.5}
                    />
                  </ActionIcon>
                </Tooltip>
              )}

              <Tooltip
                label={
                  data.isEditing
                    ? 'Validate/Close editing the grid'
                    : 'Open editing the grid'
                }
              >
                <ActionIcon
                  variant="filled"
                  aria-label="Editing"
                  onClick={() => handleEditGrid(data.i)}
                  className={classes.actionButton}
                  color={data.isEditing ? 'yellow' : 'green'}
                >
                  {data.isEditing ? (
                    <IconCheck
                      style={{ width: '70%', height: '70%' }}
                      stroke={1.5}
                    />
                  ) : (
                    <IconEdit
                      style={{ width: '70%', height: '70%' }}
                      stroke={1.5}
                    />
                  )}
                </ActionIcon>
              </Tooltip>

              {handleDeleteGrid && (
                <Tooltip label="Delete the grid">
                  <ActionIcon
                    variant="filled"
                    aria-label="Delete"
                    onClick={() => handleDeleteGrid(data.i)}
                    className={classes.actionButton}
                    color="red"
                  >
                    <IconTrash
                      style={{ width: '70%', height: '70%' }}
                      stroke={1.5}
                    />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          ) : (
            <div />
          )}
        </Group>
      </div>
    );
  },
);
