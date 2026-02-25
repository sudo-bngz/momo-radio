import { Box, HStack, Slider, Icon } from '@chakra-ui/react';
import { Volume2 } from 'lucide-react';
import { usePlayer } from '../../../context/PlayerContext'; // Update path if needed

export const VolumeControl = () => {
  const { volume, setVolume } = usePlayer();

  return (
    <HStack gap={6} justify="flex-end" ml={4} w="200px">
      
      {/* Volume Icon + Slider */}
      <HStack gap={3} flex="1">
        <Icon as={Volume2} boxSize={4} color="gray.400" />
        
        <Box flex="1" h="20px" display="flex" alignItems="center">
          <Slider.Root 
            value={[volume * 100]} 
            onValueChange={(e) => setVolume(e.value[0] / 100)} 
            max={100} 
            step={1}
            size="sm" 
            width="70%" 
            // UX FIX 1: Hand cursor on the whole slider area
            cursor="pointer"
          >
            {/* Control Wrapper (Required in Chakra v3/Ark) */}
            <Slider.Control>
              <Slider.Track bg="gray.200" h="4px" borderRadius="full">
                <Slider.Range bg="blue.600" />
              </Slider.Track>
              
              {/* UX FIX 2: The "Little Circle" Thumb */}
              <Slider.Thumb 
                index={0} 
                boxSize={3} // 12px = Nice small circle
                bg="white" 
                boxShadow="0 1px 3px rgba(0,0,0,0.3)" // distinct shadow
                border="1px solid" 
                borderColor="gray.200"
                
                // Interaction Styles
                _focus={{ transform: "scale(1.2)", boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.4)" }} 
                _hover={{ transform: "scale(1.1)" }}
                transition="transform 0.1s"
                cursor="grab" // Shows "Grab" hand when dragging
              />
            </Slider.Control>
          </Slider.Root>
        </Box>
      </HStack>
    </HStack>
  );
};