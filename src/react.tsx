import * as React from 'react'
import { ComponentClass } from 'react'
import { Subscription } from 'rxjs'
import { Store, StoreDefinition, StoreSnapshot } from './'
import { equals, getDisplayName, keys, mapValues, some } from './utils'

export type Diff<T extends string, U extends string> = ({ [P in T]: P } & { [P in U]: never } & { [x: string]: never })[T]
export type Omit<T, K extends keyof T> = { [P in Diff<keyof T, K>]: T[P] }

export function connect<StoreState extends object>(store: StoreDefinition<StoreState>) {
  return function <
    Props,
    PropsWithStore extends { store: Store<StoreState> } & Props = { store: Store<StoreState> } & Props
    >(
      Component: React.ComponentType<PropsWithStore>
    ): React.ComponentClass<Omit<PropsWithStore, 'store'>> {

    type State = {
      store: StoreSnapshot<StoreState>
      subscription: Subscription
    }

    return class extends React.Component<Omit<PropsWithStore, 'store'>, State> {
      static displayName = `withStore(${getDisplayName(Component)})`
      state = {
        store: store['store'],
        subscription: store.onAll().subscribe(({ key, previousValue, value }) => {
          if (equals(previousValue, value)) {
            return false
          }
          this.setState({ store: store['store'] })
        })
      }
      componentWillUnmount() {
        this.state.subscription.unsubscribe()
      }
      shouldComponentUpdate(props: Omit<PropsWithStore, 'store'>, state: State) {
        return state.store !== this.state.store
          || Object.keys(props).some(_ => (props as any)[_] !== (this.props as any)[_])
      }
      render() {
        return <Component {...this.props} store={this.state.store} />
      }
    }
  }
}

export function connectAs<
  Stores extends {[alias: string]: StoreDefinition<any>}
>(
  stores: Stores
) {
  return function<Props>(
    Component: React.ComponentType<{
      [K in keyof Stores]: Stores[K]['store']
    } & Props>
  ): React.ComponentClass<Props> {

    type State = {
      stores: {
        [K in keyof Stores]: Stores[K]['store']
      }
      subscriptions: Subscription[]
    }

    return class extends React.Component<Props, State> {
      static displayName = `withStore(${getDisplayName(Component)})`
      state = {
        stores: mapValues(stores, _ => _.store),
        subscriptions: keys(stores).map(k =>
          stores[k].onAll().subscribe(({ key, previousValue, value }) => {
            if (equals(previousValue, value)) {
              return false
            }
            this.setState({
              stores: Object.assign({}, this.state.stores, {[k]: stores[k]['store']})
            })
          })
        )
      }
      componentWillUnmount() {
        this.state.subscriptions.forEach(_ => _.unsubscribe())
      }
      shouldComponentUpdate(props: Props, state: State) {
        return some(state.stores, (s, k) => s !== this.state.stores[k])
          || Object.keys(props).some(_ => (props as any)[_] !== (this.props as any)[_])
      }
      render() {
        return <Component {...this.props} {...this.state.stores} />
      }
    }
  }
}
