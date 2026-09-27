import { Box, HStack, Slider, Icon } from '@chakra-ui/react';
import { Volume2 } from 'lucide-react';
import { usePlayer } from '../../../context/PlayerContext';

export const VolumeControl = () => {
  const { volume, setVolume } = usePlayer();

  return (
    <HStack 
      display={{ base: "none", md: "flex" }}
      gap={{ base: 2, lg: 6 }} 
      justify="flex-end" 
      ml={{ base: 0, md: 4 }} 
      w={{ md: "120px", lg: "200px" }}
    >
      
      {/* Volume Icon + Slider */}
      <HStack gap={3} flex="1">
        <Icon as={Volume2} boxSize={4} color="fg.muted" />
        
        <Box flex="1" h="20px" display="flex" alignItems="center">
          <Slider.Root 
            value={[volume * 100]} 
            onValueChange={(e) => setVolume(e.value[0] / 100)} 
            max={100} 
            step={1}
            size="sm" 
            // ⚡️ Fixed from 70% to 100% so it naturally fills the responsive flex box
            width="100%" 
            cursor="pointer"
          >
            <Slider.Control>
              <Slider.Track bg="gray.200" _dark={{ bg: "whiteAlpha.200" }} h="4px" borderRadius="full">
                <Slider.Range bg="blue.600" _dark={{ bg: "blue.400" }} />
              </Slider.Track>
              
              <Slider.Thumb 
                index={0} 
                boxSize={3} 
                bg="white" 
                boxShadow="0 1px 3px rgba(0,0,0,0.3)" 
                border="1px solid" 
                borderColor="border"
                _dark={{ bg: "white", borderColor: "transparent" }}
                _focus={{ transform: "scale(1.2)", boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.4)" }} 
                _hover={{ transform: "scale(1.1)" }}
                transition="transform 0.1s"
                cursor="grab" 
              />
            </Slider.Control>
          </Slider.Root>
        </Box>
      </HStack>
    </HStack>
  );
};