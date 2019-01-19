import {
  ApolloClient,
  ApolloError,
  OperationVariables,
  SubscriptionOptions,
} from 'apollo-client';
import { DocumentNode } from 'graphql';
import { useEffect, useRef, useState } from 'react';
import isEqual from 'react-fast-compare';
import { Omit } from './utils';

import { useApolloClient } from './ApolloContext';

export type OnSubscriptionData<TData> = (
  options: OnSubscriptionDataOptions<TData>
) => any;

export interface OnSubscriptionDataOptions<TData> {
  client: ApolloClient<any>;
  subscriptionData: SubscriptionHookResult<TData>;
}

export interface SubscriptionHookOptions<TData, TVariables>
  extends Omit<SubscriptionOptions<TVariables>, 'query'> {
  shouldResubscribe?: any;
  onSubscriptionData?: OnSubscriptionData<TData>;
}

export interface SubscriptionHookResult<TData> {
  data?: TData;
  error?: ApolloError;
  loading: boolean;
}

export function useSubscription<TData = any, TVariables = OperationVariables>(
  query: DocumentNode,
  options?: SubscriptionHookOptions<TData, TVariables>
): SubscriptionHookResult<TData> {
  const prevOptions = useRef<null | SubscriptionHookOptions<TData, TVariables>>(
    null
  );
  const onSubscriptionData = useRef<null | OnSubscriptionData<TData>>(null);
  const client = useApolloClient();
  const [result, setResult] = useState<SubscriptionHookResult<TData>>({
    loading: true,
  });

  let shouldResubscribe;
  if (options) {
    onSubscriptionData.current = options.onSubscriptionData || null;

    shouldResubscribe = options.shouldResubscribe;
    if (typeof shouldResubscribe === 'function') {
      shouldResubscribe = !!shouldResubscribe();
    }
  }

  let inputs;
  if (shouldResubscribe === false) {
    // never resubscribe
    inputs = [];
  } else if (shouldResubscribe === undefined) {
    inputs = [
      query,
      isEqual(prevOptions.current, options) ? prevOptions.current : options,
    ];
  }

  useEffect(() => {
    if (options) {
      prevOptions.current = options;
    }
    const subscription = client
      .subscribe({
        ...options,
        query,
      })
      .subscribe({
        error: error => {
          setResult({ loading: false, data: result.data, error });
        },
        next: nextResult => {
          const newResult = {
            data: nextResult.data,
            error: undefined,
            loading: false,
          };
          setResult(newResult);
          if (onSubscriptionData.current) {
            onSubscriptionData.current({ client, subscriptionData: newResult });
          }
        },
      });
    return () => {
      subscription.unsubscribe();
    };
  }, inputs);

  return result;
}
