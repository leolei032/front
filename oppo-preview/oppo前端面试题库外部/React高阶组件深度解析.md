# React高阶组件（HOC）深度解析

## 1. HOC的本质

### 什么是高阶组件

```javascript
// 高阶组件（Higher-Order Component）
// 定义：接收组件作为参数，返回新组件的函数

// 基础示例
function withLogger(WrappedComponent) {
  return class extends React.Component {
    componentDidMount() {
      console.log(`${WrappedComponent.name} mounted`);
    }

    render() {
      return <WrappedComponent {...this.props} />;
    }
  };
}

// 使用
class MyComponent extends React.Component {
  render() {
    return <div>Hello</div>;
  }
}

const EnhancedComponent = withLogger(MyComponent);
// <EnhancedComponent /> 会在挂载时打印日志

// HOC的本质：
// 1. 函数，不是组件
// 2. 接收组件，返回新组件
// 3. 不修改原组件，而是通过组合的方式
// 4. 纯函数，没有副作用

// HOC vs 普通组件
// 普通组件：props → UI
// HOC：组件 → 新组件
```

### 为什么需要HOC

```javascript
// 问题：多个组件需要相同的逻辑

// ❌ 不使用HOC：代码重复
class UserList extends React.Component {
  componentDidMount() {
    console.log('Component mounted');  // 重复
  }

  render() {
    return <div>User List</div>;
  }
}

class ProductList extends React.Component {
  componentDidMount() {
    console.log('Component mounted');  // 重复
  }

  render() {
    return <div>Product List</div>;
  }
}

// ✓ 使用HOC：逻辑复用
function withMountLogger(WrappedComponent) {
  return class extends React.Component {
    componentDidMount() {
      console.log(`${WrappedComponent.name} mounted`);
    }

    render() {
      return <WrappedComponent {...this.props} />;
    }
  };
}

const EnhancedUserList = withMountLogger(UserList);
const EnhancedProductList = withMountLogger(ProductList);

// HOC的优势：
// 1. 代码复用
// 2. 逻辑抽象
// 3. 渲染劫持
// 4. 状态抽象
// 5. Props操作
```

## 2. HOC的两种实现方式

### 属性代理（Props Proxy）

```javascript
// 属性代理：通过包裹组件来操作props

// 1. 基础属性代理
function withExtraProps(WrappedComponent) {
  return class extends React.Component {
    render() {
      // 添加额外的props
      const extraProps = {
        extra: 'extra value',
        timestamp: Date.now()
      };

      return <WrappedComponent {...this.props} {...extraProps} />;
    }
  };
}

// 2. 条件渲染
function withAuth(WrappedComponent) {
  return class extends React.Component {
    render() {
      if (!this.props.isAuthenticated) {
        return <div>Please login</div>;
      }

      return <WrappedComponent {...this.props} />;
    }
  };
}

// 3. Props操作
function withTransformedProps(WrappedComponent) {
  return class extends React.Component {
    render() {
      // 转换props
      const transformedProps = {
        ...this.props,
        name: this.props.name.toUpperCase(),
        age: Number(this.props.age)
      };

      return <WrappedComponent {...transformedProps} />;
    }
  };
}

// 4. 包装DOM元素
function withLayout(WrappedComponent) {
  return class extends React.Component {
    render() {
      return (
        <div className="layout">
          <header>Header</header>
          <main>
            <WrappedComponent {...this.props} />
          </main>
          <footer>Footer</footer>
        </div>
      );
    }
  };
}

// 5. 抽象state
function withToggle(WrappedComponent) {
  return class extends React.Component {
    state = {
      isToggled: false
    };

    toggle = () => {
      this.setState(prevState => ({
        isToggled: !prevState.isToggled
      }));
    };

    render() {
      return (
        <WrappedComponent
          {...this.props}
          isToggled={this.state.isToggled}
          toggle={this.toggle}
        />
      );
    }
  };
}

// 使用
class ToggleableButton extends React.Component {
  render() {
    const { isToggled, toggle } = this.props;
    return (
      <button onClick={toggle}>
        {isToggled ? 'ON' : 'OFF'}
      </button>
    );
  }
}

const EnhancedButton = withToggle(ToggleableButton);
```

### 反向继承（Inheritance Inversion）

```javascript
// 反向继承：HOC类继承WrappedComponent

// 1. 基础反向继承
function withInheritance(WrappedComponent) {
  return class extends WrappedComponent {
    render() {
      // 可以访问WrappedComponent的state、props、生命周期
      console.log('State:', this.state);
      console.log('Props:', this.props);

      return super.render();
    }
  };
}

// 2. 渲染劫持（Render Hijacking）
function withRenderHijacking(WrappedComponent) {
  return class extends WrappedComponent {
    render() {
      // 获取原始渲染结果
      const originalRender = super.render();

      // 修改渲染结果
      if (originalRender.type === 'div') {
        return React.cloneElement(originalRender, {
          style: { border: '1px solid red' }
        });
      }

      return originalRender;
    }
  };
}

// 3. 条件渲染
function withLoadingIndicator(WrappedComponent) {
  return class extends WrappedComponent {
    render() {
      if (this.props.isLoading) {
        return <div>Loading...</div>;
      }

      return super.render();
    }
  };
}

// 4. 操作state
function withDefaultState(WrappedComponent) {
  return class extends WrappedComponent {
    constructor(props) {
      super(props);
      // 修改初始state
      this.state = {
        ...this.state,
        addedByHOC: true
      };
    }

    render() {
      console.log('Enhanced state:', this.state);
      return super.render();
    }
  };
}

// 5. 渲染元素树操作
function withElementModification(WrappedComponent) {
  return class extends WrappedComponent {
    render() {
      const tree = super.render();

      // 递归修改元素树
      const modifyTree = (element) => {
        if (!React.isValidElement(element)) {
          return element;
        }

        // 为所有div添加className
        if (element.type === 'div') {
          return React.cloneElement(
            element,
            {
              className: `${element.props.className || ''} enhanced`.trim()
            },
            React.Children.map(element.props.children, modifyTree)
          );
        }

        return React.cloneElement(
          element,
          {},
          React.Children.map(element.props.children, modifyTree)
        );
      };

      return modifyTree(tree);
    }
  };
}
```

### 属性代理 vs 反向继承

```javascript
// 对比

// 属性代理
// ✓ 优点：
//   - 不侵入原组件
//   - 可以操作props
//   - 可以包装组件
//   - 支持多个HOC组合
// ✗ 缺点：
//   - 无法访问原组件的state
//   - 无法访问原组件的生命周期
//   - 多一层组件嵌套

// 反向继承
// ✓ 优点：
//   - 可以访问state
//   - 可以访问生命周期
//   - 可以渲染劫持
//   - 没有额外的组件嵌套
// ✗ 缺点：
//   - 侵入原组件
//   - 不支持函数组件
//   - 多个HOC可能冲突

// 选择建议：
// 1. 默认使用属性代理（更安全）
// 2. 需要渲染劫持时使用反向继承
// 3. 避免混用两种方式
```

## 3. HOC实战案例

### 案例1：权限控制

```javascript
// 根据用户权限显示/隐藏组件
function withPermission(requiredPermission) {
  return function(WrappedComponent) {
    return class extends React.Component {
      render() {
        const { user, ...rest } = this.props;

        // 检查权限
        if (!user || !user.permissions.includes(requiredPermission)) {
          return (
            <div className="no-permission">
              You don't have permission to view this content
            </div>
          );
        }

        return <WrappedComponent {...rest} user={user} />;
      }
    };
  };
}

// 使用
class AdminPanel extends React.Component {
  render() {
    return <div>Admin Panel</div>;
  }
}

// 只有管理员可以看到
const ProtectedAdminPanel = withPermission('admin')(AdminPanel);

// 使用
<ProtectedAdminPanel user={currentUser} />

// 多个权限
function withPermissions(...requiredPermissions) {
  return function(WrappedComponent) {
    return class extends React.Component {
      hasAllPermissions() {
        const { user } = this.props;
        return requiredPermissions.every(permission =>
          user?.permissions.includes(permission)
        );
      }

      render() {
        if (!this.hasAllPermissions()) {
          return <div>Insufficient permissions</div>;
        }

        return <WrappedComponent {...this.props} />;
      }
    };
  };
}

const SuperAdminPanel = withPermissions('admin', 'super')(AdminPanel);
```

### 案例2：数据获取

```javascript
// 为组件自动获取数据
function withDataFetching(url) {
  return function(WrappedComponent) {
    return class extends React.Component {
      state = {
        data: null,
        loading: true,
        error: null
      };

      componentDidMount() {
        this.fetchData();
      }

      componentDidUpdate(prevProps) {
        // 如果URL相关的props变化，重新获取
        if (this.getUrl(prevProps) !== this.getUrl(this.props)) {
          this.fetchData();
        }
      }

      getUrl(props) {
        // 支持动态URL
        return typeof url === 'function' ? url(props) : url;
      }

      async fetchData() {
        this.setState({ loading: true, error: null });

        try {
          const response = await fetch(this.getUrl(this.props));

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          this.setState({ data, loading: false });
        } catch (error) {
          this.setState({ error: error.message, loading: false });
        }
      }

      render() {
        const { data, loading, error } = this.state;

        if (loading) {
          return <div>Loading...</div>;
        }

        if (error) {
          return <div>Error: {error}</div>;
        }

        return <WrappedComponent {...this.props} data={data} />;
      }
    };
  };
}

// 使用
class UserList extends React.Component {
  render() {
    const { data } = this.props;

    return (
      <ul>
        {data.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    );
  }
}

// 静态URL
const UsersWithData = withDataFetching('/api/users')(UserList);

// 动态URL
const UserDetailsWithData = withDataFetching(
  props => `/api/users/${props.userId}`
)(UserDetails);

// 使用
<UserDetailsWithData userId={123} />
```

### 案例3：表单处理

```javascript
// 为表单组件添加状态管理
function withFormState(WrappedComponent) {
  return class extends React.Component {
    state = {
      values: this.props.initialValues || {},
      errors: {},
      touched: {},
      isSubmitting: false
    };

    handleChange = (name, value) => {
      this.setState(prevState => ({
        values: {
          ...prevState.values,
          [name]: value
        }
      }));
    };

    handleBlur = (name) => {
      this.setState(prevState => ({
        touched: {
          ...prevState.touched,
          [name]: true
        }
      }));

      // 验证
      this.validateField(name);
    };

    validateField = (name) => {
      const { validate } = this.props;
      if (!validate) return;

      const error = validate(name, this.state.values[name], this.state.values);

      this.setState(prevState => ({
        errors: {
          ...prevState.errors,
          [name]: error
        }
      }));
    };

    handleSubmit = async (e) => {
      e.preventDefault();

      // 标记所有字段为touched
      const touched = Object.keys(this.state.values).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {});

      this.setState({ touched, isSubmitting: true });

      // 验证所有字段
      const errors = this.props.validate
        ? Object.keys(this.state.values).reduce((acc, key) => {
            const error = this.props.validate(key, this.state.values[key], this.state.values);
            if (error) acc[key] = error;
            return acc;
          }, {})
        : {};

      this.setState({ errors });

      // 如果有错误，不提交
      if (Object.keys(errors).length > 0) {
        this.setState({ isSubmitting: false });
        return;
      }

      // 提交
      try {
        await this.props.onSubmit(this.state.values);
        this.setState({ isSubmitting: false });
      } catch (error) {
        this.setState({ isSubmitting: false });
      }
    };

    render() {
      return (
        <WrappedComponent
          {...this.props}
          values={this.state.values}
          errors={this.state.errors}
          touched={this.state.touched}
          isSubmitting={this.state.isSubmitting}
          handleChange={this.handleChange}
          handleBlur={this.handleBlur}
          handleSubmit={this.handleSubmit}
        />
      );
    }
  };
}

// 使用
class LoginForm extends React.Component {
  render() {
    const {
      values,
      errors,
      touched,
      isSubmitting,
      handleChange,
      handleBlur,
      handleSubmit
    } = this.props;

    return (
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={values.email || ''}
          onChange={e => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
        />
        {touched.email && errors.email && <div>{errors.email}</div>}

        <input
          type="password"
          value={values.password || ''}
          onChange={e => handleChange('password', e.target.value)}
          onBlur={() => handleBlur('password')}
        />
        {touched.password && errors.password && <div>{errors.password}</div>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    );
  }
}

const EnhancedLoginForm = withFormState(LoginForm);

// 使用
<EnhancedLoginForm
  initialValues={{ email: '', password: '' }}
  validate={(name, value) => {
    if (name === 'email' && !value.includes('@')) {
      return 'Invalid email';
    }
    if (name === 'password' && value.length < 6) {
      return 'Password too short';
    }
  }}
  onSubmit={async (values) => {
    await login(values);
  }}
/>
```

### 案例4：性能优化

```javascript
// 为组件添加shouldComponentUpdate优化
function withMemo(WrappedComponent, propsAreEqual) {
  return class extends React.Component {
    shouldComponentUpdate(nextProps, nextState) {
      // 使用自定义比较函数
      if (propsAreEqual) {
        return !propsAreEqual(this.props, nextProps);
      }

      // 默认浅比较
      return !shallowEqual(this.props, nextProps);
    }

    render() {
      return <WrappedComponent {...this.props} />;
    }
  };
}

function shallowEqual(objA, objB) {
  if (objA === objB) return true;

  if (typeof objA !== 'object' || objA === null ||
      typeof objB !== 'object' || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (let key of keysA) {
    if (!objB.hasOwnProperty(key) || objA[key] !== objB[key]) {
      return false;
    }
  }

  return true;
}

// 使用
class ExpensiveComponent extends React.Component {
  render() {
    console.log('Expensive render');
    return <div>{this.props.data}</div>;
  }
}

const OptimizedComponent = withMemo(ExpensiveComponent);

// 自定义比较
const CustomOptimizedComponent = withMemo(
  ExpensiveComponent,
  (prevProps, nextProps) => {
    // 只有data.id改变时才重新渲染
    return prevProps.data.id === nextProps.data.id;
  }
);
```

### 案例5：埋点统计

```javascript
// 自动为组件添加埋点
function withTracking(eventName, getEventData) {
  return function(WrappedComponent) {
    return class extends React.Component {
      componentDidMount() {
        // 曝光埋点
        this.track('view');
      }

      componentWillUnmount() {
        // 离开埋点
        this.track('leave');
      }

      track(action) {
        const eventData = getEventData ? getEventData(this.props) : {};

        // 发送埋点
        window.analytics?.track({
          event: `${eventName}_${action}`,
          ...eventData,
          timestamp: Date.now()
        });
      }

      render() {
        // 为点击事件添加埋点
        const enhancedProps = {
          ...this.props,
          onClick: (...args) => {
            this.track('click');
            this.props.onClick?.(...args);
          }
        };

        return <WrappedComponent {...enhancedProps} />;
      }
    };
  };
}

// 使用
class ProductCard extends React.Component {
  render() {
    const { product, onClick } = this.props;

    return (
      <div onClick={onClick}>
        <h3>{product.name}</h3>
        <p>{product.price}</p>
      </div>
    );
  }
}

const TrackedProductCard = withTracking(
  'product_card',
  props => ({
    product_id: props.product.id,
    product_name: props.product.name
  })
)(ProductCard);

// 使用
<TrackedProductCard
  product={{ id: 1, name: 'iPhone', price: 999 }}
  onClick={() => console.log('Clicked')}
/>
// 自动发送: product_card_view, product_card_click, product_card_leave
```

## 4. HOC组合和链式调用

```javascript
// 多个HOC组合

// 方式1：嵌套调用
const Enhanced = withA(withB(withC(BaseComponent)));

// 方式2：compose函数
function compose(...fns) {
  return fns.reduce((a, b) => (...args) => a(b(...args)));
}

const Enhanced = compose(
  withA,
  withB,
  withC
)(BaseComponent);

// 方式3：使用装饰器（需要Babel支持）
@withA
@withB
@withC
class BaseComponent extends React.Component {
  render() {
    return <div>Base</div>;
  }
}

// Redux connect + withRouter示例
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';

class UserProfile extends React.Component {
  render() {
    const { user, history } = this.props;
    return <div>{user.name}</div>;
  }
}

const Enhanced = compose(
  withRouter,
  connect(state => ({ user: state.user }))
)(UserProfile);

// 自定义compose HOC
function composeHOCs(...hocs) {
  return function(Component) {
    return hocs.reduceRight((acc, hoc) => hoc(acc), Component);
  };
}

const Enhanced2 = composeHOCs(withA, withB, withC)(BaseComponent);
```

## 5. HOC vs Hooks

```javascript
// 相同功能的HOC和Hook对比

// HOC方式
function withWindowSize(WrappedComponent) {
  return class extends React.Component {
    state = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    componentDidMount() {
      window.addEventListener('resize', this.handleResize);
    }

    componentWillUnmount() {
      window.removeEventListener('resize', this.handleResize);
    }

    handleResize = () => {
      this.setState({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    render() {
      return (
        <WrappedComponent
          {...this.props}
          windowSize={this.state}
        />
      );
    }
  };
}

class Component1 extends React.Component {
  render() {
    const { windowSize } = this.props;
    return <div>{windowSize.width} x {windowSize.height}</div>;
  }
}

const Enhanced1 = withWindowSize(Component1);

// Hook方式
function useWindowSize() {
  const [size, setSize] = React.useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  React.useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

function Component2() {
  const windowSize = useWindowSize();
  return <div>{windowSize.width} x {windowSize.height}</div>;
}

// HOC vs Hooks对比

// HOC
// ✓ 优点：
//   - 支持类组件和函数组件
//   - 可以操作生命周期
//   - 可以渲染劫持
// ✗ 缺点：
//   - 嵌套地狱
//   - Props命名冲突
//   - 多一层组件包装
//   - 静态方法丢失

// Hooks
// ✓ 优点：
//   - 更简洁
//   - 没有嵌套
//   - 没有额外的组件
//   - 更容易复用
// ✗ 缺点：
//   - 只支持函数组件
//   - 不能渲染劫持
//   - 学习成本

// 选择建议：
// 1. 新项目优先使用Hooks
// 2. 需要渲染劫持时使用HOC
// 3. 维护类组件时使用HOC
// 4. 可以两者结合使用
```

## 6. HOC最佳实践

```javascript
// 1. 不要在render中创建HOC
class BadExample extends React.Component {
  render() {
    // ❌ 每次render都创建新组件
    const Enhanced = withHOC(MyComponent);
    return <Enhanced />;
  }
}

// ✓ 在组件外部创建
const Enhanced = withHOC(MyComponent);

class GoodExample extends React.Component {
  render() {
    return <Enhanced />;
  }
}

// 2. 复制静态方法
function withHOC(WrappedComponent) {
  class HOC extends React.Component {
    render() {
      return <WrappedComponent {...this.props} />;
    }
  }

  // 复制静态方法
  hoistNonReactStatics(HOC, WrappedComponent);

  return HOC;
}

// 3. 传递refs
function withHOC(WrappedComponent) {
  class HOC extends React.Component {
    render() {
      const { forwardedRef, ...rest } = this.props;
      return <WrappedComponent ref={forwardedRef} {...rest} />;
    }
  }

  return React.forwardRef((props, ref) => {
    return <HOC {...props} forwardedRef={ref} />;
  });
}

// 4. 设置displayName
function withHOC(WrappedComponent) {
  class HOC extends React.Component {
    render() {
      return <WrappedComponent {...this.props} />;
    }
  }

  HOC.displayName = `withHOC(${getDisplayName(WrappedComponent)})`;
  return HOC;
}

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

// 5. 不要改变原组件
// ❌ 错误
function withHOC(WrappedComponent) {
  WrappedComponent.prototype.componentDidMount = function() {
    // 修改了原组件
  };
  return WrappedComponent;
}

// ✓ 正确
function withHOC(WrappedComponent) {
  return class extends React.Component {
    componentDidMount() {
      // 在新组件中添加逻辑
    }

    render() {
      return <WrappedComponent {...this.props} />;
    }
  };
}
```

HOC是React中强大的代码复用模式，虽然Hooks在很多场景下是更好的选择，但HOC仍然在某些场景下（如渲染劫持、类组件）有其独特的价值！