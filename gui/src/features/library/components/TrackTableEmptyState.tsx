import React from 'react';
import { Table, VStack, Icon, Text, Box, Spinner } from '@chakra-ui/react';
import { Music } from 'lucide-react';

interface Props {
  isLoading: boolean;
  colSpan?: number;
}

export const TrackTableEmptyState: React.FC<Props> = ({ isLoading, colSpan = 9 }) => {
  if (isLoading) {
    return (
      <Table.Row>
        <Table.Cell colSpan={colSpan} textAlign="center" py={12}>
          <Box display="flex" justifyContent="center">
            <Spinner size="xl" color="blue.500" />
          </Box>
        </Table.Cell>
      </Table.Row>
    );
  }

  return (
    <Table.Row>
      <Table.Cell colSpan={colSpan} textAlign="center" py={12} color="gray.500">
        <VStack gap={2}>
          <Icon as={Music} boxSize={8} color="gray.300" />
          <Text fontWeight="500" color="gray.900">No tracks found</Text>
          <Text fontSize="sm">Try adjusting your search query.</Text>
        </VStack>
      </Table.Cell>
    </Table.Row>
  );
};
