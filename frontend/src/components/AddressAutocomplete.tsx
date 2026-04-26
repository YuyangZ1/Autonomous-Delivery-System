import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

// SF service area bounding box — matches backend polygon
const SF_BOUNDS = {
  north: 37.8120,
  south: 37.7080,
  east: -122.3550,
  west: -122.5150,
};

interface Props {
  placeholder?: string;
  prefix?: React.ReactNode;
  onSelect: (address: string, lat: number, lng: number) => void;
  onClear: () => void;
  status?: 'error' | '';
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function AddressAutocomplete({
  placeholder,
  prefix,
  onSelect,
  onClear,
  status,
  disabled,
  style,
}: Props) {
  const placesLib = useMapsLibrary('places');
  const containerRef = useRef<HTMLDivElement>(null);
  // PlaceAutocompleteElement is a custom element — typed as any to avoid
  // tight coupling with the @types/google.maps version installed.
  const elementRef = useRef<any>(null);
  const hasSelectedRef = useRef(false);

  // Keep callbacks in refs so effects don't re-run when parent re-renders
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;

  useEffect(() => {
    if (!placesLib || !containerRef.current) return;

    const PlaceAutocompleteElement = (placesLib as any).PlaceAutocompleteElement;
    if (!PlaceAutocompleteElement) {
      console.error(
        'PlaceAutocompleteElement is not available. Make sure "Places API (New)" is enabled in Google Cloud Console.',
      );
      return;
    }

    const element = new PlaceAutocompleteElement({
      includedRegionCodes: ['us'],
      locationRestriction: SF_BOUNDS,
    });

    if (placeholder) {
      element.setAttribute('placeholder', placeholder);
    }
    element.classList.add('ddma-place-autocomplete');

    elementRef.current = element;
    containerRef.current.appendChild(element);

    // Fired when the user picks a suggestion from the dropdown
    const handleSelect = async (event: any) => {
      const placePrediction = event.placePrediction;
      if (!placePrediction) return;
      try {
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ['formattedAddress', 'location'] });
        if (place.formattedAddress && place.location) {
          hasSelectedRef.current = true;
          onSelectRef.current(
            place.formattedAddress,
            place.location.lat(),
            place.location.lng(),
          );
        }
      } catch (e) {
        console.error('Failed to fetch place details', e);
      }
    };

    // Bubbles up from the inner input — fires when user types/edits
    const handleInput = () => {
      if (hasSelectedRef.current) {
        // User edited after selecting — invalidate the selection
        hasSelectedRef.current = false;
        onClearRef.current();
      }
    };

    element.addEventListener('gmp-select', handleSelect);
    element.addEventListener('input', handleInput);

    return () => {
      element.removeEventListener('gmp-select', handleSelect);
      element.removeEventListener('input', handleInput);
      element.remove();
      elementRef.current = null;
    };
  }, [placesLib, placeholder]);

  // Toggle disabled attribute when prop changes
  useEffect(() => {
    if (!elementRef.current) return;
    if (disabled) {
      elementRef.current.setAttribute('disabled', '');
    } else {
      elementRef.current.removeAttribute('disabled');
    }
  }, [disabled]);

  const isError = status === 'error';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${isError ? '#ff4d4f' : '#d9d9d9'}`,
        borderRadius: 6,
        padding: '0 11px',
        height: 40,
        background: disabled ? '#f5f5f5' : '#ffffff',
        gap: 8,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: isError ? '0 0 0 2px rgba(255, 77, 79, 0.2)' : 'none',
        ...style,
      }}
    >
      {prefix && (
        <span style={{ display: 'flex', alignItems: 'center', color: '#bfbfbf', flexShrink: 0 }}>
          {prefix}
        </span>
      )}
      <div
        ref={containerRef}
        style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}
      />
    </div>
  );
}
